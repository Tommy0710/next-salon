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

        // Thêm biến itemsName vào cục nhận dữ liệu
        const body = await request.json();
        const { phone, customerName, invoiceId, itemsName } = body;
        
        const formattedPhone = phone.replace(/^(\+?84|0)/, '84');

        // 1. Xử lý Định dạng ngày giờ
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`; // Format ngày theo đúng mẫu 01/08/2020

        // 2. Rút gọn Mã hóa đơn
        const shortOrderCode = invoiceId ? invoiceId.toString().slice(-6).toUpperCase() : "HD001";

        const validAccessToken = await getValidZaloToken();

        // 3. ĐÓNG GÓI PAYLOAD CHUẨN XÁC 100% THEO TEMPLATE
        const zaloPayload = {
            phone: formattedPhone,
            template_id: settings.zaloTemplateId, 
            template_data: {
                date: formattedDate,
                Ma_Hoa_Don: shortOrderCode,
                name: customerName || "Quý khách",
                Ten_Hang_Hoa: itemsName || "Dịch vụ tại Dạ Spa"
            },
            tracking_id: invoiceId
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