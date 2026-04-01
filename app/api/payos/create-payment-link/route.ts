import { NextRequest, NextResponse } from "next/server";

// 1. Vẫn dùng require ở ngoài để Next.js biết đường gom thư viện này lên Vercel
const PayOSModule: any = require("@payos/node");

export async function POST(req: NextRequest) {
    try {
        // 2. ĐÂY LÀ CHÌA KHÓA: Lấy đúng class constructor ở lúc chạy (Runtime)
        // Nếu nó bị bọc trong .default thì lấy .default, còn không thì lấy chính nó
        const PayOSConstructor = PayOSModule.default || PayOSModule;

        // 3. Khởi tạo PayOS bằng constructor chuẩn vừa lấy được
        const payos = new PayOSConstructor(
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
            description: description.substring(0, 25), // PayOS giới hạn tối đa 25 ký tự
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