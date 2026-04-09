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
                date: formattedDate,
                Ma_Hoa_Don: data.invoiceId || "HD123456",
                name: data.customerName || "Quý khách",
                Ten_Hang_Hoa: data.itemsName || "Dịch vụ tại Spa"
            };

        case ZALO_EVENTS.APPOINTMENT_REMINDER:
            // Mẫu (Ví dụ): Nhắc lịch hẹn
            return {
                name: data.customerName,
                time: data.appointmentTime,
                date: data.appointmentDate,
                service: data.serviceName,
                status: "Đang chờ xác nhận"
            };
        case ZALO_EVENTS.APPOINTMENT_CONFIRMED:
            // Các biến này CẦN KHỚP CHÍNH XÁC với tên biến bạn đăng ký với Zalo cho Template Đặt lịch thành công
            return {
                customer_name: data.customerName,
                schedule_time: data.appointmentDate,
                booking_code: data.bookingCode,
                address: data.salonAddress || "51 Nguyễn Thị Minh Khai, phường Hải Châu , thành phố Đà Nẵng",
                services: data.serviceName,
                status: "Đã xác nhận"
            };

        case ZALO_EVENTS.APPOINTMENT_CANCELLED:
            // Các biến này CẦN KHỚP CHÍNH XÁC với tên biến bạn đăng ký với Zalo cho Template Hủy lịch
            return {
                name: data.customerName,
                date: data.appointmentDate,
                time: data.appointmentTime,
                status: "Đã bị hủy"
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