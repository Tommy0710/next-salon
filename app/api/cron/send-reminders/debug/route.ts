/**
 * GET /api/cron/send-reminders/debug
 *
 * Debug endpoint — KHÔNG gửi reminder thật.
 * Trả về toàn bộ diagnostic để kiểm tra tại sao cron hoạt động / không hoạt động.
 *
 * Query params:
 *   ?hours=24        — override số giờ trước (mặc định lấy từ Settings)
 *   ?reset=<aptId>   — reset reminderSent của 1 appointment về false (để test lại)
 */
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Settings from "@/models/Settings";
import { addHours, addMinutes, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import {
    isEmailConfigured,
    isSMSConfigured,
} from "@/lib/notifications";
import { ZALO_EVENTS } from "@/lib/zalo-payloads";

export async function GET(request: NextRequest) {
    // Chỉ cho phép trong môi trường dev hoặc khi có CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const isDev = process.env.NODE_ENV === "development";

    if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(request.url);
    const hoursOverride = searchParams.get("hours");
    const resetAptId = searchParams.get("reset");

    // Reset reminderSent nếu được yêu cầu (để test lại)
    if (resetAptId) {
        await Appointment.findByIdAndUpdate(resetAptId, {
            $set: { reminderSent: false, reminderSentAt: null },
        });
        return NextResponse.json({ success: true, message: `Reset reminderSent for ${resetAptId}` });
    }

    const settings = await Settings.findOne();

    // ── 1. Config ─────────────────────────────────────────────────────────────
    const reminderHours: number = hoursOverride
        ? Number(hoursOverride)
        : (settings?.reminderHoursBefore ?? 24);
    const methods: string[] = settings?.reminderMethods ?? ["email"];
    const timezone: string = settings?.timezone || "Asia/Ho_Chi_Minh";

    const emailEnabled = await isEmailConfigured();
    const smsEnabled = await isSMSConfigured();
    const zaloTemplateConfig = settings?.zaloEnabled
        ? settings?.zaloTemplates?.find((t: any) => t.eventType === ZALO_EVENTS.APPOINTMENT_REMINDER)
        : null;
    const zaloEnabled = !!(zaloTemplateConfig?.templateId);

    const configDiag = {
        reminderHours,
        methods,
        timezone,
        emailEnabled,
        smsEnabled,
        zaloEnabled,
        zaloTemplateId: zaloTemplateConfig?.templateId ?? null,
        activeMethodEnabled:
            (methods.includes("email") && emailEnabled) ||
            (methods.includes("sms") && smsEnabled) ||
            (methods.includes("zalo") && zaloEnabled),
    };

    // ── 2. Time window ────────────────────────────────────────────────────────
    const now = new Date();
    const targetTime = addHours(now, reminderHours);
    const windowStart = addMinutes(targetTime, -30);
    const windowEnd = addMinutes(targetTime, 30);

    const dateFrom = new Date(windowStart);
    dateFrom.setUTCHours(0, 0, 0, 0);
    const dateTo = new Date(windowEnd);
    dateTo.setUTCHours(23, 59, 59, 999);

    const windowDiag = {
        serverNow: format(now, "yyyy-MM-dd HH:mm:ss 'UTC'"),
        targetTime: format(targetTime, "yyyy-MM-dd HH:mm:ss 'UTC'"),
        windowStart: format(windowStart, "yyyy-MM-dd HH:mm:ss 'UTC'"),
        windowEnd: format(windowEnd, "yyyy-MM-dd HH:mm:ss 'UTC'"),
        dateFrom: format(dateFrom, "yyyy-MM-dd HH:mm:ss 'UTC'"),
        dateTo: format(dateTo, "yyyy-MM-dd HH:mm:ss 'UTC'"),
    };

    // ── 3. Candidates từ DB ──────────────────────────────────────────────────
    const candidates = await Appointment.find({
        date: { $gte: dateFrom, $lte: dateTo },
        status: "confirmed",
        reminderSent: { $ne: true },
    })
        .populate("customer", "name phone email")
        .populate("staff", "name")
        .lean();

    // Tìm thêm: appointments đã reminderSent=true trong cùng ngày (để debug)
    const alreadySent = await Appointment.find({
        date: { $gte: dateFrom, $lte: dateTo },
        status: "confirmed",
        reminderSent: true,
    })
        .populate("customer", "name phone email")
        .lean();

    // ── 4. Filter chính xác theo startTime + timezone ─────────────────────────
    const passed: any[] = [];
    const filtered: any[] = [];

    for (const apt of candidates) {
        if (!apt.startTime) {
            filtered.push({ id: apt._id, reason: "missing startTime" });
            continue;
        }
        try {
            const d = new Date(apt.date);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, "0");
            const day = String(d.getUTCDate()).padStart(2, "0");
            const localDateStr = `${year}-${month}-${day}T${apt.startTime}:00`;
            const aptUTC = fromZonedTime(localDateStr, timezone);

            const inWindow = aptUTC >= windowStart && aptUTC <= windowEnd;
            const entry = {
                id: apt._id,
                customer: (apt.customer as any)?.name,
                phone: (apt.customer as any)?.phone,
                date: format(d, "yyyy-MM-dd"),
                startTime: apt.startTime,
                localDateStr,
                aptUTC: format(aptUTC, "yyyy-MM-dd HH:mm:ss 'UTC'"),
                inWindow,
            };
            if (inWindow) passed.push(entry);
            else filtered.push({ ...entry, reason: "outside time window" });
        } catch (e: any) {
            filtered.push({ id: apt._id, reason: `parse error: ${e.message}` });
        }
    }

    return NextResponse.json({
        debug: true,
        config: configDiag,
        window: windowDiag,
        candidates: {
            total: candidates.length,
            passedFilter: passed.length,
            filteredOut: filtered.length,
        },
        appointments: {
            willSend: passed,
            skippedByTimeFilter: filtered,
            alreadySentToday: alreadySent.map((a: any) => ({
                id: a._id,
                customer: a.customer?.name,
                startTime: a.startTime,
                reminderSentAt: a.reminderSentAt,
            })),
        },
        howToFix: {
            noActiveMethod: !configDiag.activeMethodEnabled
                ? "⚠️ Không có method nào active. Kiểm tra Settings → reminderMethods và bật Zalo/Email/SMS."
                : null,
            noCandidates: candidates.length === 0
                ? "⚠️ Không có appointment nào trạng thái 'confirmed' trong ngày target và chưa gửi nhắc."
                : null,
            allFilteredOut: candidates.length > 0 && passed.length === 0
                ? `⚠️ Có ${candidates.length} candidate nhưng tất cả nằm ngoài window ±30 phút. Kiểm tra cột aptUTC so với windowStart/windowEnd.`
                : null,
            tip: `Để test lại appointment đã gửi, gọi: GET /api/cron/send-reminders/debug?reset=<appointmentId>`,
        },
    });
}
