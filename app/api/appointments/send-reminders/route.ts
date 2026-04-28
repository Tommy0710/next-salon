import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Appointment } from "@/lib/initModels";
import { addDays, startOfDay, endOfDay } from "date-fns";
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
import { formatAppointmentDateTime } from '@/lib/zaloDate';
import { logActivity } from "@/lib/logger";
import Settings from "@/models/Settings";
import ZaloLog from "@/models/ZaloLog";

const ZALO_MAX_RETRIES = 3;

async function sendZaloReminderWithRetry(params: {
    phone: string;
    templateId: string;
    templateName: string;
    templateData: any;
    trackingId: string;
    eventType: string;
}): Promise<boolean> {
    const { phone, templateId, templateName, templateData, trackingId, eventType } = params;
    const formattedPhone = phone.replace(/^(\+?84|0)/, '84');
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= ZALO_MAX_RETRIES; attempt++) {
        const result = await sendZaloZNS(phone, templateId, templateData);

        if (result.success) {
            await ZaloLog.create({
                phone: formattedPhone,
                templateId,
                templateName,
                eventType,
                trackingId,
                sentAt: new Date(),
                status: 'success',
                responseData: result.data,
            });
            console.log(`✅ Zalo Reminder OK (attempt ${attempt}) → ${phone}`);
            return true;
        }

        lastError = result.error;
        console.warn(`⚠️ Zalo Retry ${attempt}/${ZALO_MAX_RETRIES} → ${phone}: ${lastError}`);

        if (attempt < ZALO_MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    await ZaloLog.create({
        phone: formattedPhone,
        templateId,
        templateName,
        eventType,
        trackingId,
        sentAt: new Date(),
        status: 'failed',
        errorMessage: lastError,
    });

    console.error(`❌ Zalo Reminder failed after ${ZALO_MAX_RETRIES} attempts → ${phone}: ${lastError}`);
    return false;
}

// POST /api/appointments/send-reminders - Send reminders for upcoming appointments
export async function POST(request: Request) {
    try {
        await connectToDB();

        const body = await request.json();
        const { daysBefore = 1, methods = ['sms', 'email'] } = body;

        const emailEnabled = await isEmailConfigured();
        const smsEnabled = await isSMSConfigured();
        const settings = await Settings.findOne();

        const zaloTemplateConfig = settings?.zaloEnabled
            ? settings?.zaloTemplates?.find((t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER)
            : null;
        const zaloEnabled = !!(zaloTemplateConfig?.templateId);

        if (!emailEnabled && !smsEnabled && !zaloEnabled) {
            return NextResponse.json({
                success: false,
                error: "No notification methods are configured. Please set up SMTP, Twilio, or Zalo ZNS credentials.",
            }, { status: 500 });
        }

        const targetDate = addDays(new Date(), daysBefore);
        const startDate = startOfDay(targetDate);
        const endDate = endOfDay(targetDate);

        const appointments = await Appointment.find({
            date: { $gte: startDate, $lte: endDate },
            status: 'confirmed',
            reminderSent: { $ne: true }
        })
            .populate('customer', 'name phone email')
            .populate('staff', 'name')
            .populate('services.service', 'name');

        if (appointments.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No appointments found for reminders",
                count: 0
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
            const services = appointment.services.map((s: any) => s.name);

            let smsSent = false;
            let emailSent = false;
            let zaloSent = false;

            // Send SMS
            if (methods.includes('sms') && smsEnabled && customer.phone) {
                const smsMessage = getAppointmentReminderSMS(
                    customer.name,
                    staff?.name,
                    dateStr,
                    timeStr,
                    process.env.SALON_NAME || 'Our Salon'
                );
                smsSent = await sendSMS(customer.phone, smsMessage);
            }

            // Send Email
            if (methods.includes('email') && emailEnabled && customer.email) {
                const emailContent = getAppointmentReminderEmail(
                    customer.name,
                    staff?.name,
                    dateStr,
                    timeStr,
                    services,
                    process.env.SALON_NAME || 'Our Salon',
                    process.env.SALON_PHONE,
                    process.env.SALON_ADDRESS
                );
                emailSent = await sendEmail(
                    customer.email,
                    emailContent.subject,
                    emailContent.html,
                    emailContent.text
                );
            }

            // Send Zalo ZNS — direct call with retry
            if (methods.includes('zalo') && zaloEnabled && customer.phone) {
                const payloadData = {
                    customerName: customer.name || "Quý khách",
                    appointmentDate: dateStr,
                    bookingCode: appointment.bookingCode || appointment._id.toString().substring(0, 8).toUpperCase(),
                    serviceName: services.length > 0 ? services.join(', ') : "Dịch vụ Spa",
                    status: "Sắp tới giờ hẹn",
                };

                const templateData = buildTemplateData(ZALO_EVENTS.APPOINTMENT_REMINDER, payloadData);

                zaloSent = await sendZaloReminderWithRetry({
                    phone: customer.phone,
                    templateId: zaloTemplateConfig.templateId,
                    templateName: zaloTemplateConfig.name || ZALO_EVENTS.APPOINTMENT_REMINDER,
                    templateData,
                    trackingId: appointment._id.toString(),
                    eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                });
            }

            if (smsSent || emailSent || zaloSent) {
                appointment.reminderSent = true;
                appointment.reminderSentAt = new Date();
                await appointment.save();

                remindersSent.push({
                    appointmentId: appointment._id,
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    customerEmail: customer.email,
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
                    error: "Failed to send via any method"
                });
            }
        }

        await logActivity({
            req: request,
            action: 'create',
            resource: 'reminder',
            details: `Sent ${remindersSent.length} appointment reminders (${errors.length} failed) for ${targetDate.toDateString()}`,
        });

        return NextResponse.json({
            success: true,
            message: `Sent ${remindersSent.length} reminders`,
            count: remindersSent.length,
            reminders: remindersSent,
            errors: errors.length > 0 ? errors : undefined,
            config: { emailEnabled, smsEnabled, zaloEnabled }
        });

    } catch (error: any) {
        console.error('Error sending reminders:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// GET /api/appointments/send-reminders - Check appointments needing reminders
export async function GET(request: Request) {
    try {
        await connectToDB();

        const { searchParams } = new URL(request.url);
        const daysBefore = parseInt(searchParams.get("daysBefore") || "1");

        const targetDate = addDays(new Date(), daysBefore);
        const startDate = startOfDay(targetDate);
        const endDate = endOfDay(targetDate);

        const appointments = await Appointment.find({
            date: { $gte: startDate, $lte: endDate },
            status: 'confirmed',
            reminderSent: { $ne: true }
        })
            .populate('customer', 'name phone email')
            .populate('staff', 'name');

        const count = appointments.length;

        return NextResponse.json({
            success: true,
            count,
            message: `${count} appointments need reminders`,
            appointments: appointments.map((apt: any) => ({
                id: apt._id,
                customer: apt.customer?.name,
                staff: apt.staff?.name,
                date: apt.date,
                time: apt.startTime,
                hasPhone: !!apt.customer?.phone,
                hasEmail: !!apt.customer?.email,
            })),
            config: {
                emailEnabled: await isEmailConfigured(),
                smsEnabled: await isSMSConfigured(),
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
