import { NextRequest, NextResponse } from "next/server";

// CÁCH FIX LỖI 1: Sử dụng require thay vì import nếu TypeScript vẫn báo lỗi ts(2351)
// Tùy vào cấu hình tsconfig, nếu import PayOS from "@payos/node" lỗi, hãy dùng dòng require dưới đây:
const PayOS = require("@payos/node");

// Thêm 'as string' để báo cho TypeScript biết các biến môi trường này chắc chắn tồn tại
const payos = new PayOS(
    process.env.PAYOS_CLIENT_ID as string,
    process.env.PAYOS_API_KEY as string,
    process.env.PAYOS_CHECKSUM_KEY as string
);

// CÁCH FIX LỖI 2: Khai báo kiểu dữ liệu NextRequest cho biến 'req'
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { invoiceId, amount, description } = body;

        // Tạo mã đơn hàng ngẫu nhiên (PayOS yêu cầu orderCode là số)
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

        // CÁCH FIX LỖI 3: Kiểm tra kiểu của error trước khi lấy .message
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định từ PayOS";

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}