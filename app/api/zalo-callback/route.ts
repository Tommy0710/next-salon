import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. Zalo đá về link này, ta sẽ "tóm" lấy cái mã code trên thanh URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // Nếu không có code (user bấm Hủy hoặc lỗi), báo lỗi ngay
    if (!code) {
        return NextResponse.json({ error: "Không tìm thấy mã xác thực từ Zalo" }, { status: 400 });
    }

    // 2. Gọi các biến bảo mật từ file .env
    const appId = process.env.ZALO_APP_ID;
    const secretKey = process.env.ZALO_SECRET_KEY;
    // Chuỗi code_verifier GỐC của bạn (Chưa mã hóa)
    const codeVerifier = "doancode_tommy_quin_yeu_bi_mat_cua_daspa_0905836456"; 

    try {
        // 3. Bắn API (S2S - Server to Server) sang Zalo để đổi mã lấy Chìa khóa
        const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "secret_key": secretKey as string, // Bắt buộc phải truyền Secret Key ở header
            },
            body: new URLSearchParams({
                app_id: appId as string,
                grant_type: "authorization_code",
                code: code,
                code_verifier: codeVerifier, // Trình lên chuỗi gốc để Zalo đối chiếu
            })
        });

        const data = await response.json();

        // 4. Hiển thị kết quả
        if (data.access_token) {
            // In thẳng ra màn hình trình duyệt để bạn copy cho dễ
            return NextResponse.json({
                message: "🎉 XÁC THỰC THÀNH CÔNG! BẠN HÃY COPY MÃ NÀY VÀO FILE .ENV",
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in_seconds: data.expires_in
            });
        } else {
            // In ra lỗi nếu Zalo từ chối
            return NextResponse.json({ 
                message: "Zalo từ chối cấp quyền", 
                error: data 
            }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ message: "Lỗi máy chủ nội bộ", error: String(error) }, { status: 500 });
    }
}