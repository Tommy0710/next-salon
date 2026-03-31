import { NextResponse } from 'next/server';
import { getValidZaloToken } from '@/lib/zalo';
import { buildTemplateData } from '@/lib/zalo-payloads';
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
        // payloadData chứa các thông tin thô (Tên khách, ID hóa đơn...) từ Frontend gửi lên
        const { phone, eventType, payloadData } = body; 

        // 1. Tìm Template ID tương ứng với Sự kiện trong Database
        const templateConfig = settings.zaloTemplates?.find((t: any) => t.eventType === eventType);
        if (!templateConfig || !templateConfig.templateId) {
            return NextResponse.json({ success: false, error: `Chưa cấu hình Template ID cho sự kiện ${eventType}` }, { status: 400 });
        }

        const formattedPhone = phone.replace(/^(\+?84|0)/, '84');

        // 2. Tự động đóng gói tham số nhờ vào file thư viện mới tạo
        const finalTemplateData = buildTemplateData(eventType, payloadData);

        const validAccessToken = await getValidZaloToken();

        const zaloPayload = {
            phone: formattedPhone,
            template_id: templateConfig.templateId, 
            template_data: finalTemplateData,
            tracking_id: payloadData.invoiceId || Date.now().toString()
        };

        const zaloResponse = await fetch("https://business.openapi.zalo.me/message/template", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "access_token": validAccessToken,
            },
            body: JSON.stringify(zaloPayload)
        });

        const zaloResult = await zaloResponse.json();

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