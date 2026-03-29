import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, customerName, invoiceId, totalAmount } = body;

        // Bắt buộc: Zalo yêu cầu số điện thoại định dạng mã quốc gia (ví dụ: 84901234567)
        // Hàm này giúp chuyển đổi số 0 ở đầu thành 84
        const formattedPhone = phone.replace(/^0/, '84');

        // Cấu trúc payload chuẩn của Zalo ZNS
        const zaloPayload = {
            phone: formattedPhone,
            template_id: process.env.ZALO_TEMPLATE_ID, // Lấy từ file .env
            template_data: {
                customer_name: customerName || "Quý khách",
                invoice_id: invoiceId,
                total_amount: totalAmount.toString()
            },
            tracking_id: invoiceId // Dùng ID hóa đơn để dễ kiểm tra lỗi trên hệ thống Zalo sau này
        };

        // Bắn API sang Zalo
        const zaloResponse = await fetch("https://business.openapi.zalo.me/message/template", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "access_token": process.env.ZALO_ACCESS_TOKEN as string, // Lấy từ file .env
            },
            body: JSON.stringify(zaloPayload)
        });

        const zaloResult = await zaloResponse.json();

        // Zalo trả về mã lỗi (nếu có)
        if (zaloResult.error) {
            console.error("Zalo API Error:", zaloResult);
            return NextResponse.json({ success: false, error: zaloResult.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: zaloResult });

    } catch (error) {
        console.error("Error sending ZNS:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}