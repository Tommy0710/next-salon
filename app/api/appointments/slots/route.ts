// Ví dụ logic cho app/api/appointments/slots/route.ts
import { NextResponse } from 'next/server';
import Appointment from "@/models/Appointment";
import Settings from "@/models/Settings";
import { connectToDB } from "@/lib/mongodb";

export async function GET(request: Request) {
    try {
        await connectToDB();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // Lấy cấu hình Booking Rules
        const settings = await Settings.findOne() || {};
        const bookingRules = settings.bookingRules || {
            workingDays: ['1', '2', '3', '4', '5', '6', '0'],
            shift1: { start: "08:00", end: "12:00" },
            shift2: { start: "13:00", end: "17:00" }
        };

        // Xác định thứ trong tuần của ngày được chọn
        let dayOfWeek = "";
        if (date) {
            const parts = date.split('-');
            if (parts.length === 3) {
                const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                dayOfWeek = localDate.getDay().toString();
            } else {
                dayOfWeek = new Date(date).getDay().toString();
            }
        } else {
            dayOfWeek = new Date().getDay().toString();
        }

        const allSlots: string[] = [];

        // Kiểm tra xem ngày đó có làm việc không
        if (bookingRules.workingDays.includes(dayOfWeek)) {
            // Hàm sinh slot cho 1 ca làm việc
            const generateSlotsForShift = (shift: { start: string, end: string }) => {
                if (!shift || !shift.start || !shift.end) return;
                const [sh, sm] = shift.start.split(':').map(Number);
                const [eh, em] = shift.end.split(':').map(Number);

                let current = new Date();
                current.setHours(sh, sm, 0, 0);

                let end = new Date();
                end.setHours(eh, em, 0, 0);

                while (current < end) {
                    allSlots.push(current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
                    current.setMinutes(current.getMinutes() + 30); // Mỗi slot 30 phút
                }
            };

            generateSlotsForShift(bookingRules.shift1);
            generateSlotsForShift(bookingRules.shift2);
        }

        if (!date) return NextResponse.json({ success: true, data: allSlots });

        // 2. (Tùy chọn) Tìm các lịch đã đặt trong ngày này để loại trừ
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookedAppointments = await Appointment.find({
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['pending', 'confirmed'] } // Chỉ lấy các lịch chưa hủy
        }).select('startTime');

        const bookedTimes = bookedAppointments.map(app => app.startTime);

        // Lọc bỏ những giờ đã bị đặt (Nếu Spa của bạn 1 giờ chỉ nhận 1 khách)
        const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

        return NextResponse.json({ success: true, data: availableSlots });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Lỗi server" }, { status: 500 });
    }
}