import { NextResponse } from 'next/server';
import { getValidZaloToken } from '@/lib/zalo';
import Settings from '@/models/Settings';
import dbConnect from '@/lib/mongodb';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const settings = await Settings.findOne();
        
        if (!settings || !settings.zaloEnabled) {
            return NextResponse.json({ success: false, error: "ZNS đang tắt" }, { status: 400 });
        }

        const body = await request.json();
        const { phone, customerName, invoiceId, totalAmount } = body;
        
        // Zalo yêu cầu định dạng đầu số 84
        const formattedPhone = phone.replace(/^0/, '84');

        // 👉 1. Xử lý Định dạng ngày giờ hiện tại (VD: 30/03/2026 15:30)
        const now = new Date();
        const formattedDate = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        // 👉 2. Xử lý Định dạng tiền tệ VNĐ (VD: 150.000 ₫)
        const formattedCost = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount);

        // 👉 3. Rút gọn Mã hóa đơn từ ID của Database (Lấy 6 ký tự cuối, viết hoa cho chuyên nghiệp)
        const shortOrderCode = invoiceId ? invoiceId.toString().slice(-6).toUpperCase() : "HD001";

        // Gọi hàm tự động lấy Token (đã xử lý gia hạn 3 tháng)
        const validAccessToken = await getValidZaloToken();

        // Đóng gói dữ liệu CHUẨN KHỚP 100% VỚI TEMPLATE DẠ SPA
        const zaloPayload = {
            phone: formattedPhone,
            template_id: settings.zaloTemplateId, 
            template_data: {
                customer_name: customerName || "Quý khách",
                order_code: shortOrderCode,
                date: formattedDate,
                total_cost: formattedCost,
                note: "Cảm ơn quý khách đã tin tưởng và trải nghiệm dịch vụ tại Dạ Spa!"
            },
            tracking_id: invoiceId // Lưu vết ID gốc để kiểm tra lỗi trên Zalo sau này
        };

        // Bắn API sang Zalo
        const zaloResponse = await fetch("https://business.openapi.zalo.me/message/template", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "access_token": validAccessToken,
            },
            body: JSON.stringify(zaloPayload)
        });

        const zaloResult = await zaloResponse.json();

        // Kiểm tra lỗi từ phía Zalo
        if (zaloResult.error) {
            console.error("Zalo API Error:", zaloResult);
            return NextResponse.json({ success: false, error: zaloResult.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: zaloResult });

    } catch (error: any) {
        console.error("Lỗi gửi Zalo ZNS:", error);
        return NextResponse.json({ success: false, error: error.message || "Internal Error" }, { status: 500 });
    }
}