import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Appointment } from "@/lib/initModels";
import { addDays, startOfDay, endOfDay, format } from "date-fns";
import {
    sendSMS,
    sendEmail,
    getAppointmentReminderSMS,
    getAppointmentReminderEmail,
    isEmailConfigured,
    isSMSConfigured,
} from "@/lib/notifications";
import { ZALO_EVENTS, buildTemplateData } from "@/lib/zalo-payloads";
import Settings from "@/models/Settings";
import ZaloLog from "@/models/ZaloLog";

// POST /api/appointments/send-reminders - Send reminders for upcoming appointments
export async function POST(request: Request) {
    try {
        await connectToDB();

        const body = await request.json();
        const { daysBefore = 1, methods = ['sms', 'email'] } = body; // methods: array of ['sms', 'email', 'zalo']

        // Check configuration
        const emailEnabled = await isEmailConfigured();
        const smsEnabled = await isSMSConfigured();
        const settings = await Settings.findOne();
        const zaloEnabled = settings?.zaloEnabled && settings?.zaloTemplates?.find((t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER)?.templateId;

        if (!emailEnabled && !smsEnabled && !zaloEnabled) {
            return NextResponse.json({
                success: false,
                error: "No notification methods are configured. Please set up SMTP, Twilio, or Zalo ZNS credentials.",
            }, { status: 500 });
        }

        // Get appointments for the target date
        const targetDate = addDays(new Date(), daysBefore);
        const startDate = startOfDay(targetDate);
        const endDate = endOfDay(targetDate);

        // Find appointments that haven't had reminders sent
        const appointments = await Appointment.find({
            date: { $gte: startDate, $lte: endDate },
            status: { $in: ['pending', 'confirmed'] },
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

        const remindersSent = [];
        const errors = [];

        for (const appointment of appointments) {
            const customer: any = appointment.customer;
            const staff: any = appointment.staff;

            if (!customer) {
                errors.push({ appointmentId: appointment._id, error: "Customer not found" });
                continue;
            }

            const dateStr = format(new Date(appointment.date), 'MMMM dd, yyyy');
            const timeStr = appointment.startTime;
            const services = appointment.services.map((s: any) => s.name);

            let smsSent = false;
            let emailSent = false;
            let zaloSent = false;

            // Send SMS
            if (methods.includes('sms') && smsEnabled && customer.phone) {
                const smsMessage = getAppointmentReminderSMS(
                    customer.name,
                    staff.name,
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
                    staff.name,
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

            // Send Zalo ZNS
            if (methods.includes('zalo') && zaloEnabled && customer.phone) {
                try {
                    const baseUrl = new URL(request.url).origin;
                    const zaloResponse = await fetch(`${baseUrl}/api/zalo/zns`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            phone: customer.phone,
                            eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                            payloadData: {
                                customerName: customer.name || "Quý khách",
                                appointmentDate: dateStr,
                                appointmentTime: timeStr,
                                serviceName: services.join(', ')
                            }
                        })
                    });

                    const zaloResult = await zaloResponse.json();
                    zaloSent = zaloResult.success;

                    // Log Zalo reminder attempt
                    const templateConfig = settings?.zaloTemplates?.find((t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER);
                    await ZaloLog.create({
                        phone: customer.phone.replace(/^(\+?84|0)/, '84'),
                        templateId: templateConfig?.templateId || '',
                        templateName: templateConfig?.name || 'Appointment Reminder',
                        eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                        status: zaloSent ? 'success' : 'failed',
                        errorMessage: zaloSent ? undefined : 'Zalo reminder failed',
                        trackingId: `reminder_${appointment._id}_${Date.now()}`,
                        sentAt: new Date(),
                        responseData: zaloResult,
                    });

                } catch (error) {
                    console.error("Zalo reminder error:", error);
                    zaloSent = false;

                    // Log Zalo reminder failure
                    const templateConfig = settings?.zaloTemplates?.find((t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER);
                    await ZaloLog.create({
                        phone: customer.phone.replace(/^(\+?84|0)/, '84'),
                        templateId: templateConfig?.templateId || '',
                        templateName: templateConfig?.name || 'Appointment Reminder',
                        eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                        status: 'failed',
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                        trackingId: `reminder_${appointment._id}_${Date.now()}`,
                        sentAt: new Date(),
                        responseData: { error: error },
                    });
                }
            }

            // Mark as sent if at least one method succeeded
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

        return NextResponse.json({
            success: true,
            message: `Sent ${remindersSent.length} reminders`,
            count: remindersSent.length,
            reminders: remindersSent,
            errors: errors.length > 0 ? errors : undefined,
            config: {
                emailEnabled,
                smsEnabled,
                zaloEnabled,
            }
        });
    } catch (error: any) {
        console.error('Error sending reminders:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
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
            status: { $in: ['pending', 'confirmed'] },
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
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
