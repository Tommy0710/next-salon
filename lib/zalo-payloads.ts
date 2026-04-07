// lib/zalo-payloads.ts

// 1. Định nghĩa các "Sự kiện" sẽ gửi Zalo
export const ZALO_EVENTS = {
    CHECKOUT: 'checkout',
    APPOINTMENT: 'appointment',
    REMINDER: 'reminder',
    BIRTHDAY: 'birthday',
};

// 2. Hàm tự động lắp ráp dữ liệu (Payload) tùy theo Sự kiện
export const buildTemplateData = (eventType: string, data: any) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    switch (eventType) {
        case ZALO_EVENTS.CHECKOUT:
            // Mẫu: Thanh toán thành công (Mẫu Dạ Spa đang dùng)
            return {
                date: formattedDate,
                Ma_Hoa_Don: data.invoiceId ? data.invoiceId.toString().slice(-6).toUpperCase() : "HD001",
                name: data.customerName || "Quý khách",
                Ten_Hang_Hoa: data.itemsName || "Dịch vụ tại Spa"
            };

        case ZALO_EVENTS.REMINDER:
            // Mẫu (Ví dụ): Nhắc lịch hẹn
            return {
                name: data.customerName,
                time: data.appointmentTime,
                date: data.appointmentDate,
                service: data.serviceName
            };
        case ZALO_EVENTS.APPOINTMENT:
            // Mẫu (Ví dụ): Xác nhận lịch hẹn
            return {
                name: data.customerName,
                bookingId: data.bookingId,
                time: data.appointmentTime,
                date: data.appointmentDate,
                service: data.serviceName
            };
        case ZALO_EVENTS.BIRTHDAY:
            // Mẫu (Ví dụ): Chúc mừng sinh nhật
            return {
                name: data.customerName,
                date: formattedDate,
                offer: "Ưu đãi đặc biệt nhân dịp sinh nhật!"
            };

        default:
            throw new Error(`Chưa có cấu trúc tham số cho sự kiện: ${eventType}`);
    }
};