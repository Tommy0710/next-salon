import { NextRequest, NextResponse } from "next/server";

// Ép kiểu ': any' ngay từ lúc require để TypeScript bị "mù" hoàn toàn với thư viện này
const PayOS: any = require("@payos/node");

export async function POST(req: NextRequest) {
    try {
        // Ép kiểu String() để đảm bảo biến môi trường luôn là chuỗi, tránh lỗi undefined
        const payos = new PayOS(
            String(process.env.PAYOS_CLIENT_ID),
            String(process.env.PAYOS_API_KEY),
            String(process.env.PAYOS_CHECKSUM_KEY)
        );

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

        const paymentLinkData = await payos.createPaymentLink(requestData);

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