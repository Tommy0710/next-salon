import { NextRequest, NextResponse } from "next/server";

// 1. Dùng require thuần của Node.js thay vì import để Turbopack không can thiệp sai cách
// @ts-ignore
const PayOS = require("@payos/node");

// 2. Ép kiểu (PayOS as any) để TypeScript không còn báo lỗi "not constructable" (ts 2351)
const payos = new (PayOS as any)(
    process.env.PAYOS_CLIENT_ID as string,
    process.env.PAYOS_API_KEY as string,
    process.env.PAYOS_CHECKSUM_KEY as string
);

export async function POST(req: NextRequest) {
    try {
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