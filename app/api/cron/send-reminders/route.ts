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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize VN phone to E.164 format: 84xxxxxxxxx */
function normalizePhone(raw: string): string {
    return raw.replace(/\s+/g, "").replace(/^(\+?84|0)/, "84");
}

/**
 * Combine the UTC-midnight `date` field with local `startTime` ("HH:MM") and
 * convert to a UTC moment using the salon's timezone.
 *
 * The `date` field is stored as UTC midnight of the **local** calendar day,
 * so we read its UTC year/month/day to reconstruct the local date string.
 */
function computeAptUTC(
    date: Date,
    startTime: string,
    timezone: string
): Date | null {
    try {
        const d = new Date(date);
        const yy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        return fromZonedTime(`${yy}-${mm}-${dd}T${startTime}:00`, timezone);
    } catch {
        return null;
    }
}

/** Returns whether the appointment's UTC moment falls within [windowStart, windowEnd]. */
function isInWindow(
    date: Date,
    startTime: string,
    timezone: string,
    windowStart: Date,
    windowEnd: Date
): { inWindow: boolean; aptUTC: Date | null } {
    const aptUTC = computeAptUTC(date, startTime, timezone);
    if (!aptUTC) return { inWindow: false, aptUTC: null };
    return {
        inWindow: aptUTC >= windowStart && aptUTC <= windowEnd,
        aptUTC,
    };
}

interface ZaloConfig {
    templateId: string;
    name?: string;
}

/** Only log in development — keep production logs silent */
const devLog = (level: "log" | "warn" | "error", payload: object): void => {
    if (process.env.NODE_ENV === "development")
        console[level](JSON.stringify(payload));
};

/**
 * Race a promise against a timeout.
 * Rejects with Error("Timeout after Xms") if the promise doesn't resolve in time.
 */
function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        ),
    ]);
}

/**
 * Send Zalo ZNS with up to 3 attempts (exponential backoff).
 * Logs result (success/failed) to ZaloLog with full response data.
 * Returns true only on confirmed success.
 */
async function sendZaloWithRetry(
    normalizedPhone: string,
    config: ZaloConfig,
    templateData: Record<string, any>,
    trackingId: string
): Promise<boolean> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Wrap with 5s timeout so a hung Zalo API never blocks the cron job
        let result: any;
        try {
            result = await withTimeout(
                sendZaloZNS(normalizedPhone, config.templateId, templateData),
                5000
            );
        } catch (e: any) {
            result = { success: false, error: e.message };
        }

        if (result.success) {
            await ZaloLog.create({
                phone: normalizedPhone,
                templateId: config.templateId,
                templateName: config.name || ZALO_EVENTS.APPOINTMENT_REMINDER,
                eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                trackingId,
                sentAt: new Date(),
                status: "success",
                responseData: result.data,
            });

            devLog("log", {
                level: "info",
                event: "zalo_sent",
                trackingId,
                attempt,
                messageId: result.data?.msg_id ?? result.data?.message_id ?? null,
            });
            return true;
        }

        // Distinguish retryable vs permanent failures in the log
        const isLastAttempt = attempt === MAX_RETRIES;
        const errorCode = result.data?.error ?? result.data?.error_code ?? null;

        devLog("warn", {
            level: "warn",
            event: "zalo_attempt_failed",
            trackingId,
            attempt,
            errorCode,
            errorMessage: result.error,
            fullResponse: result.data ?? null,
            willRetry: !isLastAttempt,
        });

        if (!isLastAttempt) {
            // Exponential backoff: 1s → 2s
            await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
            // All retries exhausted — write final failure log
            await ZaloLog.create({
                phone: normalizedPhone,
                templateId: config.templateId,
                templateName: config.name || ZALO_EVENTS.APPOINTMENT_REMINDER,
                eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                trackingId,
                sentAt: new Date(),
                status: "failed",
                errorMessage: result.error,
                responseData: result.data ?? null,
            });
        }
    }

    return false;
}

// ── Route handler ─────────────────────────────────────────────────────────────

// GET /api/cron/send-reminders
// Called by Vercel Cron with: Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectToDB();

        const settings = (await Settings.findOne().lean()) as any;

        const reminderHours: number = settings?.reminderHoursBefore ?? 24;
        const methods: string[] = settings?.reminderMethods ?? ["email"];
        const timezone: string = settings?.timezone || "Asia/Ho_Chi_Minh";
        const storeName: string =
            settings?.storeName || process.env.SALON_NAME || "Our Salon";

        if (methods.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No reminder methods configured in settings.",
            });
        }

        const [emailEnabled, smsEnabled] = await Promise.all([
            isEmailConfigured(),
            isSMSConfigured(),
        ]);

        const zaloTemplateConfig: ZaloConfig | null = settings?.zaloEnabled
            ? (settings?.zaloTemplates?.find(
                (t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER
            ) ?? null)
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
        const targetTime = addHours(now, reminderHours);
        const windowStart = addMinutes(targetTime, -30);
        const windowEnd = addMinutes(targetTime, 30);

        // ±1 UTC day buffer so UTC-offset mismatches never drop an appointment
        // from the DB query. The precise JS isInWindow() check handles filtering.
        const dateFrom = new Date(windowStart);
        dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);
        dateFrom.setUTCHours(0, 0, 0, 0);
        const dateTo = new Date(windowEnd);
        dateTo.setUTCDate(dateTo.getUTCDate() + 1);
        dateTo.setUTCHours(23, 59, 59, 999);

        // Idempotency gate: skip appointments attempted within the last 10 minutes.
        // Combined with the atomic claim below, this prevents duplicate sends
        // even when multiple cron instances run concurrently.
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

        // ── Step 1: Lean candidate query (only fields needed for window check) ──
        // Suggested index: { date: 1, status: 1, reminderSent: 1 }
        const candidateIds: { _id: any; date: Date; startTime: string }[] =
            await Appointment.find({
                date: { $gte: dateFrom, $lte: dateTo },
                status: "confirmed",
                reminderSent: { $ne: true },
                $or: [
                    { lastReminderAttemptAt: { $exists: false } },
                    { lastReminderAttemptAt: { $lt: tenMinutesAgo } },
                ],
            })
                .select("_id date startTime")
                .lean();

        devLog("log", {
            level: "info",
            event: "cron_candidates_queried",
            total: candidateIds.length,
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
            reminderHours,
        });

        // ── Step 2: Precise JS time-window check ─────────────────────────────
        const windowMatched = candidateIds.filter(({ _id, date, startTime }) => {
            if (!startTime) return false;
            const { inWindow, aptUTC } = isInWindow(
                date,
                startTime,
                timezone,
                windowStart,
                windowEnd
            );

            devLog("log", {
                level: "debug",
                event: "window_check",
                appointmentId: _id.toString(),
                aptUTC: aptUTC?.toISOString() ?? null,
                windowStart: windowStart.toISOString(),
                windowEnd: windowEnd.toISOString(),
                decision: inWindow ? "in_window" : "out_of_window",
            });

            return inWindow;
        });

        if (windowMatched.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No appointments in reminder window",
                count: 0,
                window: { from: windowStart, to: windowEnd, reminderHours, methods },
            });
        }

        const remindersSent: any[] = [];
        const errors: any[] = [];
        let claimSkipped = 0;

        // ── Step 3: Atomic claim + send ───────────────────────────────────────
        for (const { _id } of windowMatched) {
            // findOneAndUpdate is atomic: only one concurrent cron instance wins.
            // If another instance already set lastReminderAttemptAt in the past
            // 10 minutes, this returns null and we skip — no duplicate send.
            const apt = await Appointment.findOneAndUpdate(
                {
                    _id,
                    reminderSent: { $ne: true },
                    $or: [
                        { lastReminderAttemptAt: { $exists: false } },
                        { lastReminderAttemptAt: { $lt: tenMinutesAgo } },
                    ],
                },
                { $set: { lastReminderAttemptAt: new Date() } },
                { new: true }
            )
                .populate("customer", "name phone email")
                .populate("staff", "name");

            if (!apt) {
                // Another concurrent instance claimed this appointment first
                claimSkipped++;
                devLog("log", {
                    level: "info",
                    event: "claim_skipped",
                    appointmentId: _id.toString(),
                    reason: "already_claimed_or_sent",
                });
                continue;
            }

            const customer: any = apt.customer;
            if (!customer) {
                errors.push({ appointmentId: _id, error: "Customer not found" });
                continue;
            }

            // All providers use the same normalized E.164 phone
            const normalizedPhone = customer.phone
                ? normalizePhone(customer.phone)
                : null;

            const dateStr = formatAppointmentDateTime(apt.date, apt.startTime);
            const staffName = (apt.staff as any)?.name;
            const services = apt.services.map(
                (s: any) => s.name || s.service?.name || ""
            );

            let smsSent = false;
            let emailSent = false;
            let zaloSent = false;

            // SMS — uses normalized E.164 phone
            if (methods.includes("sms") && smsEnabled && normalizedPhone) {
                const smsMessage = getAppointmentReminderSMS(
                    customer.name,
                    staffName,
                    dateStr,
                    apt.startTime,
                    storeName
                );
                smsSent = await sendSMS(normalizedPhone, smsMessage);
            }

            // Email
            if (methods.includes("email") && emailEnabled && customer.email) {
                const emailContent = getAppointmentReminderEmail(
                    customer.name,
                    staffName,
                    dateStr,
                    apt.startTime,
                    services,
                    storeName,
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

            // Zalo ZNS — uses normalized E.164 phone
            if (
                methods.includes("zalo") &&
                zaloEnabled &&
                zaloTemplateConfig &&
                normalizedPhone
            ) {
                const templateData = buildTemplateData(
                    ZALO_EVENTS.APPOINTMENT_REMINDER,
                    {
                        customerName: customer.name || "Quý khách",
                        appointmentDate: dateStr,
                        bookingCode:
                            apt.bookingCode ||
                            apt._id.toString().substring(0, 8).toUpperCase(),
                        serviceName:
                            services.length > 0
                                ? services.join(", ")
                                : "Dịch vụ Spa",
                        status: "Sắp tới giờ hẹn",
                    }
                );

                zaloSent = await sendZaloWithRetry(
                    normalizedPhone,
                    zaloTemplateConfig,
                    templateData,
                    _id.toString()
                );
            }

            if (smsSent || emailSent || zaloSent) {
                // Use updateOne (not .save()) to avoid race with other fields
                await Appointment.updateOne(
                    { _id },
                    {
                        $set: { reminderSent: true, reminderSentAt: new Date() },
                        $inc: { reminderCount: 1 },
                    }
                );

                remindersSent.push({
                    appointmentId: _id,
                    customerName: customer.name,
                    date: apt.date,
                    time: apt.startTime,
                    smsSent,
                    emailSent,
                    zaloSent,
                });

                devLog("log", {
                    level: "info",
                    event: "reminder_sent",
                    appointmentId: _id.toString(),
                    smsSent,
                    emailSent,
                    zaloSent,
                });
            } else {
                errors.push({
                    appointmentId: _id,
                    customerName: customer.name,
                    error: "Failed to send via any method",
                });

                devLog("error", {
                    level: "error",
                    event: "reminder_all_failed",
                    appointmentId: _id.toString(),
                });
            }
        }

        // ── Summary ───────────────────────────────────────────────────────────
        devLog("log", {
            level: "info",
            event: "cron_summary",
            totalCandidates: candidateIds.length,
            passedWindowFilter: windowMatched.length,
            claimSkipped,
            sent: remindersSent.length,
            failed: errors.length,
        });

        await logActivity({
            req: request,
            action: "create",
            resource: "reminder",
            details: `[CRON] Sent ${remindersSent.length} reminders (${errors.length} failed, ${claimSkipped} race-skipped). Window: ${reminderHours}h ±30min`,
        });

        return NextResponse.json({
            success: true,
            message: `Sent ${remindersSent.length} reminders`,
            count: remindersSent.length,
            reminders: remindersSent,
            errors: errors.length > 0 ? errors : undefined,
            config: { reminderHours, methods, emailEnabled, smsEnabled, zaloEnabled },
            window: { from: windowStart, to: windowEnd },
            stats: {
                candidates: candidateIds.length,
                inWindow: windowMatched.length,
                claimSkipped,
                sent: remindersSent.length,
                failed: errors.length,
            },
        });
    } catch (error: any) {
        devLog("error", {
            level: "error",
            event: "cron_fatal",
            message: error.message,
            stack: error.stack,
        });
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
