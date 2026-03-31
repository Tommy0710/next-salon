import { NextResponse } from 'next/server';

// Hàm POST dùng để nhận dữ liệu từ Website gửi về
export async function POST(request: Request) {
    try {
        // 1. Đọc dữ liệu JSON từ form website gửi qua
        const body = await request.json();

        // 2. In ra màn hình Terminal để kiểm tra (Console log)
        console.log("=========================================");
        console.log("🔔 CÓ KHÁCH ĐẶT LỊCH MỚI TỪ WEBSITE!");
        console.log("Dữ liệu nhận được:", body);
        console.log("=========================================");

        // 3. Trả lời lại cho Website biết là "Tôi đã nhận được rồi nhé"
        // (Nếu không có đoạn này, website của bạn sẽ báo lỗi Timeout)
        return NextResponse.json({ 
            success: true, 
            message: "Webhook đã nhận dữ liệu thành công!" 
        }, { status: 200 });

    } catch (error: any) {
        console.error("Lỗi Webhook:", error);
        return NextResponse.json({ 
            success: false, 
            error: "Dữ liệu gửi lên không hợp lệ hoặc không phải JSON" 
        }, { status: 400 });
    }
}

// Hàm GET dùng để test xem link webhook có hoạt động không khi dán vào trình duyệt
export async function GET() {
    return NextResponse.json({ 
        message: "Trạm thu sóng Webhook Booking đang hoạt động tốt. Hãy dùng phương thức POST để gửi dữ liệu." 
    });
}