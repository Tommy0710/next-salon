// app/api/appointments/slots/route.ts
import { NextResponse } from 'next/server';
import Appointment from "@/models/Appointment";
import Settings from "@/models/Settings";
import { connectToDB } from "@/lib/mongodb";

/**
 * Converts a "HH:MM" time string to total minutes since midnight.
 */
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Converts total minutes since midnight back to "HH:MM" string.
 */
function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Generates all time slots for a shift given a slot duration (in minutes).
 */
function generateSlotsForShift(
    shift: { start: string; end: string },
    slotDuration: number
): string[] {
    if (!shift?.start || !shift?.end) return [];

    const startMin = timeToMinutes(shift.start);
    const endMin = timeToMinutes(shift.end);
    const slots: string[] = [];

    for (let current = startMin; current + slotDuration <= endMin; current += slotDuration) {
        slots.push(minutesToTime(current));
    }

    return slots;
}

export async function GET(request: Request) {
    try {
        await connectToDB();

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // ── 1. Load Settings ────────────────────────────────────────────────
        const settings = await Settings.findOne().lean() as any || {};
        const bookingRules = settings?.bookingRules || {};

        const workingDays: string[] = bookingRules.workingDays ?? ['1', '2', '3', '4', '5', '6', '0'];
        const shift1 = bookingRules.shift1 ?? { start: "08:00", end: "12:00" };
        const shift2 = bookingRules.shift2 ?? { start: "13:00", end: "17:00" };

        // 🔑 Dynamic settings
        const clientsPerSession: number = Math.max(1, bookingRules.clientsPerSession ?? 1);
        const avgSessionDuration: number = Math.max(5, bookingRules.avgSessionDuration ?? 60);

        // ── 2. Determine day of week ────────────────────────────────────────
        let dayOfWeek: string;
        if (date) {
            const parts = date.split('-');
            if (parts.length === 3) {
                const localDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2])
                );
                dayOfWeek = localDate.getDay().toString();
            } else {
                dayOfWeek = new Date(date).getDay().toString();
            }
        } else {
            dayOfWeek = new Date().getDay().toString();
        }

        // ── 3. Generate all slots for the day ──────────────────────────────
        const allSlots: string[] = [];

        if (workingDays.includes(dayOfWeek)) {
            allSlots.push(...generateSlotsForShift(shift1, avgSessionDuration));
            allSlots.push(...generateSlotsForShift(shift2, avgSessionDuration));
        }

        // If no date specified, return all theoretical slots (no capacity check)
        if (!date) {
            return NextResponse.json({
                success: true,
                data: allSlots,
                meta: {
                    slotDurationMinutes: avgSessionDuration,
                    clientsPerSession,
                    totalSlots: allSlots.length,
                }
            });
        }

        // ── 4. Count booked appointments per slot ──────────────────────────
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookedAppointments = await Appointment.find({
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['pending', 'confirmed'] },
        }).select('startTime').lean() as { startTime: string }[];

        // Build a map: startTime → count of bookings
        const bookingCountMap: Record<string, number> = {};
        for (const appt of bookedAppointments) {
            const t = appt.startTime;
            bookingCountMap[t] = (bookingCountMap[t] ?? 0) + 1;
        }

        // ── 5. Filter slots by remaining capacity ──────────────────────────
        const availableSlots = allSlots
            .map(slot => ({
                time: slot,
                booked: bookingCountMap[slot] ?? 0,
                capacity: clientsPerSession,
                available: clientsPerSession - (bookingCountMap[slot] ?? 0),
            }))
            .filter(slot => slot.available > 0);

        return NextResponse.json({
            success: true,
            // Trả về mảng time string để backward-compatible với các component đang dùng
            data: availableSlots.map(s => s.time),
            // Meta để FE có thể hiển thị thêm thông tin capacity nếu muốn
            meta: {
                slotDurationMinutes: avgSessionDuration,
                clientsPerSession,
                totalSlots: allSlots.length,
                availableSlotsCount: availableSlots.length,
                slots: availableSlots, // Chi tiết từng slot kèm capacity
            }
        });

    } catch (error) {
        console.error('[SLOTS API ERROR]', error);
        return NextResponse.json(
            { success: false, error: "Lỗi server" },
            { status: 500 }
        );
    }
}