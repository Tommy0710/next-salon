// Ví dụ logic cho app/api/appointments/slots/route.ts
import { NextResponse } from 'next/server';
import Appointment from "@/models/Appointment";
import { connectToDB } from "@/lib/mongodb";

export async function GET(request: Request) {
    try {
        await connectToDB();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // 1. Tạo danh sách cố định
        const allSlots = [];
        let current = new Date();
        current.setHours(9, 30, 0, 0); 
        const end = new Date();
        end.setHours(20, 30, 0, 0);   

        while (current <= end) {
            allSlots.push(current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
            current.setMinutes(current.getMinutes() + 30);
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

        // Nếu Spa bạn 1 giờ nhận được nhiều khách, cứ trả về allSlots
        return NextResponse.json({ success: true, data: availableSlots });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Lỗi server" }, { status: 500 });
    }
}