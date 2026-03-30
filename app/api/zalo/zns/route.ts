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
        const formattedPhone = phone.replace(/^0/, '84');

        // 👉 GỌI HÀM TRỢ LÝ Ở ĐÂY: Hàm này sẽ tự lo việc kiểm tra và refresh token
        const validAccessToken = await getValidZaloToken();

        const zaloPayload = {
            phone: formattedPhone,
            template_id: settings.zaloTemplateId, 
            template_data: {
                customer_name: customerName || "Quý khách",
                invoice_id: invoiceId,
                total_amount: totalAmount.toString()
            },
            tracking_id: invoiceId
        };

        const zaloResponse = await fetch("https://business.openapi.zalo.me/message/template", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "access_token": validAccessToken, // 👈 Truyền Token "tươi" vào đây
            },
            body: JSON.stringify(zaloPayload)
        });

        const zaloResult = await zaloResponse.json();

        if (zaloResult.error) {
            return NextResponse.json({ success: false, error: zaloResult.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: zaloResult });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || "Internal Error" }, { status: 500 });
    }
}