import Settings from '@/models/Settings';
import dbConnect from '@/lib/mongodb';

export async function getValidZaloToken() {
    await dbConnect();
    
    // Lấy cấu hình từ Database
    const settings = await Settings.findOne();
    if (!settings || !settings.zaloEnabled || !settings.zaloRefreshToken) {
        throw new Error("Zalo ZNS chưa được bật hoặc thiếu Refresh Token");
    }

    const now = new Date();
    
    // 1. Kiểm tra xem Token hiện tại còn hạn không (Trừ hao 5 phút để an toàn)
    if (settings.zaloTokenExpiresAt && settings.zaloTokenExpiresAt > new Date(now.getTime() + 5 * 60000)) {
        return settings.zaloAccessToken; // Vẫn còn hạn thì dùng luôn
    }

    // 2. Nếu hết hạn, dùng Refresh Token để đổi Access Token mới
    console.log("Zalo Access Token đã hết hạn. Đang tiến hành làm mới...");
    
    const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "secret_key": settings.zaloSecretKey,
        },
        body: new URLSearchParams({
            app_id: settings.zaloAppId,
            grant_type: "refresh_token",
            refresh_token: settings.zaloRefreshToken,
        })
    });

    const data = await response.json();

    if (data.access_token) {
        // 3. Lưu Token mới và hạn sử dụng mới vào lại Database
        settings.zaloAccessToken = data.access_token;
        settings.zaloRefreshToken = data.refresh_token;
        
        // Zalo trả về expires_in (thường là 90000 giây = 25 giờ)
        settings.zaloTokenExpiresAt = new Date(now.getTime() + parseInt(data.expires_in) * 1000);
        
        await settings.save();
        console.log("Đã làm mới và lưu Zalo Token thành công!");
        
        return data.access_token;
    } else {
        console.error("Lỗi làm mới Zalo Token:", data);
        throw new Error("Không thể làm mới Zalo Token. Vui lòng cấp quyền lại.");
    }
}
// Thêm đoạn này vào dưới cùng của file lib/zalo.ts

export async function sendZaloZNS(phone: string, templateId: string, templateData: any) {
    try {
        if (!phone) return { success: false, error: "Thiếu số điện thoại" };

        const token = await getValidZaloToken();
        
        // ĐỊNH DẠNG SỐ ĐIỆN THOẠI THÔNG MINH:
        // Zalo bắt buộc số điện thoại dạng 849xxx, nếu user nhập 09xxx thì phải tự động cắt đổi
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '84' + formattedPhone.slice(1);
        }

        const response = await fetch("https://business.openapi.zalo.me/message/template", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "access_token": token
            },
            body: JSON.stringify({
                phone: formattedPhone,
                template_id: templateId,
                template_data: templateData
            })
        });

        const result = await response.json();
        
        if (result.error) {
            console.error(`❌ Lỗi gửi Zalo ZNS cho số ${formattedPhone}:`, result);
            return { success: false, error: result.message };
        }
        
        console.log(`✅ Đã gửi ZNS thành công đến ${formattedPhone}`);
        return { success: true, data: result };
    } catch (error: any) {
        console.error("❌ Lỗi hệ thống Zalo Service:", error);
        return { success: false, error: error.message };
    }
}