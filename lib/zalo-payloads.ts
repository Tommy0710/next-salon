// lib/zalo-payloads.ts

// 1. Định nghĩa các "Sự kiện" sẽ gửi Zalo
export const ZALO_EVENTS = {
    CHECKOUT: 'checkout',
    APPOINTMENT: 'appointment',
    BIRTHDAY: 'birthday',
    APPOINTMENT_REMINDER: 'appointment_reminder',
    APPOINTMENT_CONFIRMED: 'appointment_confirmed',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
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
                customer_name: data.customerName || "Quý khách",
                invoice_number: data.invoiceId || "HD123456",
                date: formattedDate,
                services: data.itemsName || "Dịch vụ tại Spa",
            };

        case ZALO_EVENTS.APPOINTMENT_REMINDER:
            // Mẫu (Ví dụ): Nhắc lịch hẹn
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate || "",
                booking_code: data.bookingCode || "",
                services: data.serviceName || "",
                status: data.status || "Đang chờ xác nhận",
            };
        case ZALO_EVENTS.APPOINTMENT_CONFIRMED:
            // Các biến này CẦN KHỚP CHÍNH XÁC với tên biến bạn đăng ký với Zalo cho Template Đặt lịch thành công
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate || "",
                booking_code: data.bookingCode || "",
                services: data.serviceName || "",
                status: data.status || "Đã xác nhận"
            };

        case ZALO_EVENTS.APPOINTMENT_CANCELLED:
            // Các biến này CẦN KHỚP CHÍNH XÁC với tên biến bạn đăng ký với Zalo cho Template Hủy lịch
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate || "",
                booking_code: data.bookingCode || "",
                services: data.serviceName || "",
                status: data.status || "Đã bị hủy",
            };
        case ZALO_EVENTS.BIRTHDAY:
            // Mẫu (Ví dụ): Chúc mừng sinh nhật
            return {
                customer_name: data.customerName || "Quý khách",

            };

        default:
            throw new Error(`Chưa có cấu trúc tham số cho sự kiện: ${eventType}`);
    }
};