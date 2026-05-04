import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Appointment } from "@/lib/initModels";
import { addHours, addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import {
    sendSMS,
    sendEmail,
    getAppointmentReminderSMS,
    getAppointmentReminderEmail,
    isEmailConfigured,
    isSMSConfigured,
} from "@/lib/notifications";
import { ZALO_EVENTS, buildTemplateData } from "@/lib/zalo-payloads";
import { sendZaloZNS } from "@/lib/zalo";
import { formatAppointmentDateTime } from "@/lib/zaloDate";
import { logActivity } from "@/lib/logger";
import Settings from "@/models/Settings";
import ZaloLog from "@/models/ZaloLog";

// GET /api/cron/send-reminders
// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectToDB();

        const settings = await Settings.findOne();

        // Read reminder config from Settings
        const reminderHours: number = settings?.reminderHoursBefore ?? 24;
        const methods: string[] = settings?.reminderMethods ?? ["email"];
        const timezone: string = settings?.timezone || "Asia/Ho_Chi_Minh";

        if (methods.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No reminder methods configured in settings.",
            });
        }

        const emailEnabled = await isEmailConfigured();
        const smsEnabled = await isSMSConfigured();

        const zaloTemplateConfig = settings?.zaloEnabled
            ? settings?.zaloTemplates?.find(
                (t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER
            )
            : null;
        const zaloEnabled = !!(zaloTemplateConfig?.templateId);

        const activeMethodEnabled =
            (methods.includes("email") && emailEnabled) ||
            (methods.includes("sms") && smsEnabled) ||
            (methods.includes("zalo") && zaloEnabled);

        if (!activeMethodEnabled) {
            return NextResponse.json({
                success: false,
                error: "No configured notification service matches the selected reminder methods.",
                methods,
                emailEnabled,
                smsEnabled,
                zaloEnabled,
            });
        }

        const now = new Date();

        // Target window: appointments happening in [now + hours - 30min, now + hours + 30min]
        // This ensures each hourly cron run covers exactly one slot without overlap
        const targetTime = addHours(now, reminderHours);
        const windowStart = addMinutes(targetTime, -30);
        const windowEnd = addMinutes(targetTime, 30);

        // Cast a wide date net then filter precisely by startTime
        // date in DB is stored as UTC midnight of the appointment date
        // startTime is "HH:MM" in the salon's local timezone
        const dateFrom = new Date(windowStart);
        dateFrom.setUTCHours(0, 0, 0, 0);
        const dateTo = new Date(windowEnd);
        dateTo.setUTCHours(23, 59, 59, 999);

        const candidates = await Appointment.find({
            date: { $gte: dateFrom, $lte: dateTo },
            status: "confirmed",
            reminderSent: { $ne: true },
        })
            .populate("customer", "name phone email")
            .populate("staff", "name")
            .populate("services.service", "name");

        // Filter by combining date (UTC) + startTime (local) → UTC datetime, then check window
        const appointments = candidates.filter((apt: any) => {
            if (!apt.startTime) return false;
            try {
                const d = new Date(apt.date);
                const year = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, "0");
                const day = String(d.getUTCDate()).padStart(2, "0");
                // Treat date+startTime as local timezone → convert to UTC
                const aptUTC = fromZonedTime(
                    `${year}-${month}-${day}T${apt.startTime}:00`,
                    timezone
                );
                return aptUTC >= windowStart && aptUTC <= windowEnd;
            } catch {
                return false;
            }
        });

        if (appointments.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No appointments in reminder window",
                count: 0,
                window: { from: windowStart, to: windowEnd, reminderHours, methods },
            });
        }

        const remindersSent: any[] = [];
        const errors: any[] = [];

        for (const appointment of appointments) {
            const customer: any = appointment.customer;
            const staff: any = appointment.staff;

            if (!customer) {
                errors.push({ appointmentId: appointment._id, error: "Customer not found" });
                continue;
            }

            const dateStr = formatAppointmentDateTime(appointment.date, appointment.startTime);
            const timeStr = appointment.startTime;
            const services = appointment.services.map((s: any) => s.name || s.service?.name || "");

            let smsSent = false;
            let emailSent = false;
            let zaloSent = false;

            // SMS
            if (methods.includes("sms") && smsEnabled && customer.phone) {
                const smsMessage = getAppointmentReminderSMS(
                    customer.name,
                    staff?.name,
                    dateStr,
                    timeStr,
                    settings?.storeName || process.env.SALON_NAME || "Our Salon"
                );
                smsSent = await sendSMS(customer.phone, smsMessage);
            }

            // Email
            if (methods.includes("email") && emailEnabled && customer.email) {
                const emailContent = getAppointmentReminderEmail(
                    customer.name,
                    staff?.name,
                    dateStr,
                    timeStr,
                    services,
                    settings?.storeName || process.env.SALON_NAME || "Our Salon",
                    settings?.phone || process.env.SALON_PHONE,
                    settings?.address || process.env.SALON_ADDRESS
                );
                emailSent = await sendEmail(
                    customer.email,
                    emailContent.subject,
                    emailContent.html,
                    emailContent.text
                );
            }

            // Zalo ZNS
            if (methods.includes("zalo") && zaloEnabled && customer.phone) {
                const payloadData = {
                    customerName: customer.name || "Quý khách",
                    appointmentDate: dateStr,
                    bookingCode:
                        appointment.bookingCode ||
                        appointment._id.toString().substring(0, 8).toUpperCase(),
                    serviceName:
                        services.length > 0 ? services.join(", ") : "Dịch vụ Spa",
                    status: "Sắp tới giờ hẹn",
                };

                const templateData = buildTemplateData(
                    ZALO_EVENTS.APPOINTMENT_REMINDER,
                    payloadData
                );

                const formattedPhone = customer.phone.replace(/^(\+?84|0)/, "84");
                let zaloSuccess = false;

                for (let attempt = 1; attempt <= 3; attempt++) {
                    const result = await sendZaloZNS(
                        customer.phone,
                        zaloTemplateConfig.templateId,
                        templateData
                    );
                    if (result.success) {
                        await ZaloLog.create({
                            phone: formattedPhone,
                            templateId: zaloTemplateConfig.templateId,
                            templateName:
                                zaloTemplateConfig.name ||
                                ZALO_EVENTS.APPOINTMENT_REMINDER,
                            eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                            trackingId: appointment._id.toString(),
                            sentAt: new Date(),
                            status: "success",
                            responseData: result.data,
                        });
                        zaloSuccess = true;
                        break;
                    }
                    if (attempt < 3) {
                        await new Promise((r) => setTimeout(r, 1000 * attempt));
                    } else {
                        await ZaloLog.create({
                            phone: formattedPhone,
                            templateId: zaloTemplateConfig.templateId,
                            templateName:
                                zaloTemplateConfig.name ||
                                ZALO_EVENTS.APPOINTMENT_REMINDER,
                            eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                            trackingId: appointment._id.toString(),
                            sentAt: new Date(),
                            status: "failed",
                            errorMessage: result.error,
                        });
                    }
                }

                zaloSent = zaloSuccess;
            }

            if (smsSent || emailSent || zaloSent) {
                appointment.reminderSent = true;
                appointment.reminderSentAt = new Date();
                await appointment.save();

                remindersSent.push({
                    appointmentId: appointment._id,
                    customerName: customer.name,
                    date: appointment.date,
                    time: appointment.startTime,
                    smsSent,
                    emailSent,
                    zaloSent,
                });
            } else {
                errors.push({
                    appointmentId: appointment._id,
                    customerName: customer.name,
                    error: "Failed to send via any method",
                });
            }
        }

        await logActivity({
            req: request,
            action: "create",
            resource: "reminder",
            details: `[CRON] Sent ${remindersSent.length} reminders (${errors.length} failed). Window: ${reminderHours}h ±30min`,
        });

        return NextResponse.json({
            success: true,
            message: `Sent ${remindersSent.length} reminders`,
            count: remindersSent.length,
            reminders: remindersSent,
            errors: errors.length > 0 ? errors : undefined,
            config: { reminderHours, methods, emailEnabled, smsEnabled, zaloEnabled },
            window: { from: windowStart, to: windowEnd },
        });
    } catch (error: any) {
        console.error("[CRON] Error sending reminders:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
