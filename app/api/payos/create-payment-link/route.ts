import { NextRequest, NextResponse } from "next/server";

// 1. Đổi thành import có dấu ngoặc nhọn (Named Import) theo chuẩn V2
import { PayOS } from "@payos/node";

export async function POST(req: NextRequest) {
    try {
        // 2. Khởi tạo bằng một Object chứa các key
        const payos = new PayOS({
            clientId: String(process.env.PAYOS_CLIENT_ID),
            apiKey: String(process.env.PAYOS_API_KEY),
            checksumKey: String(process.env.PAYOS_CHECKSUM_KEY)
        });

        const body = await req.json();
        const { invoiceId, amount, description } = body;

        // Tạo mã đơn hàng ngẫu nhiên (PayOS yêu cầu orderCode là số nguyên)
        const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));

        const requestData = {
            orderCode: orderCode,
            amount: amount,
            description: description.substring(0, 25), // PayOS giới hạn 25 ký tự
            returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${invoiceId}?payos=success`,
            cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${invoiceId}?payos=cancel`,
        };

        // 3. Sử dụng API mới của bản V2: paymentRequests.create
        const paymentLinkData = await payos.paymentRequests.create(requestData);

        return NextResponse.json({
            success: true,
            checkoutUrl: paymentLinkData.checkoutUrl,
        });

    } catch (error: unknown) {
        console.error("PayOS Error:", error);

        // Kiểm tra kiểu của error trước khi lấy .message
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định từ PayOS";

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}