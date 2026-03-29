import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. "Bắt" cái mã dài ngoằng Zalo trả về trên thanh URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: "Không tìm thấy authorization code từ Zalo" }, { status: 400 });
    }

    // 2. Chuẩn bị thông tin ứng dụng
    // LƯU Ý: Bạn cần thay 2 biến này bằng App ID và Secret Key thật của Zalo App Daspanotification
    const appId = process.env.ZALO_APP_ID || "2880551396517666421"; 
    const secretKey = process.env.ZALO_SECRET_KEY || "GuIB3iFSdIXNeRqGEABZ"; 
    const codeVerifier = "doancode_tommy_quin_yeu_bi_mat_cua_daspa_0905836456"; // Chuỗi bí mật của bạn

    try {
        // 3. Bắn API cuối cùng để đổi Code lấy Access Token
        const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "secret_key": secretKey,
            },
            body: new URLSearchParams({
                code: code,
                app_id: appId,
                grant_type: "authorization_code",
                code_verifier: codeVerifier,
            })
        });

        const data = await response.json();

        // 4. In ra Terminal (Console của VS Code) để bạn copy
        console.log("=========================================");
        console.log("🎉 THÀNH CÔNG! CHÌA KHÓA ZALO CỦA BẠN ĐÂY:");
        console.log("Access Token:", data.access_token);
        console.log("Refresh Token:", data.refresh_token);
        console.log("=========================================");

        return NextResponse.json({
            message: "Lấy token thành công! Hãy mở Terminal (VS Code) để xem và copy chìa khóa.",
            zalo_response: data
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Đã xảy ra lỗi khi gọi Zalo" }, { status: 500 });
    }
}