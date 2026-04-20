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
    const formatDateTime = (dateInput?: string | Date) => {
        const d = dateInput ? new Date(dateInput) : new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes} ${day}/${month}/${year}`;
    };

    const now = new Date();

    // Hàm xử lý thông minh: Nhận cả String (từ API appointments) hoặc Array
    const buildServiceName = (servicesData?: any[], serviceNameString?: string) => {
        let names: string[] = [];

        // Nếu data truyền vào là 1 mảng các object chứa thuộc tính name
        if (Array.isArray(servicesData) && servicesData.length > 0) {
            names = servicesData.map(s => s?.name || s).filter(Boolean);
        }
        // Nếu data truyền vào là 1 chuỗi string (từ app/api/appointments/route.ts)
        else if (serviceNameString) {
            names = serviceNameString.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Không có dữ liệu trả về mặc định
        if (names.length === 0) return "Dịch vụ Spa";

        // Rút gọn nếu có nhiều hơn 2 dịch vụ
        if (names.length <= 2) {
            return names.join(', ');
        }

        return `${names[0]}, ${names[1]} +${names.length - 2} dịch vụ khác`;
    };

    switch (eventType) {
        case ZALO_EVENTS.CHECKOUT:
            // Mẫu: Thanh toán thành công (Mẫu Dạ Spa đang dùng)
            return {
                customer_name: data.customerName || "Quý khách",
                invoice_number: data.invoiceId || "HD123456",
                date: formatDateTime(now),
                services: data.itemsName || "Dịch vụ tại Spa",
            };

        case ZALO_EVENTS.APPOINTMENT_REMINDER:
            // Mẫu: Nhắc lịch hẹn
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate,
                booking_code: data.bookingCode || "",
                // Bỏ vào cả data.services (mảng) và data.serviceName (chuỗi) để hàm tự động xử lý
                services: buildServiceName(data.services, data.serviceName),
                status: data.status || "Đang chờ xác nhận",
            };

        case ZALO_EVENTS.APPOINTMENT_CONFIRMED:
            // Mẫu: Đặt lịch thành công
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate,
                booking_code: data.bookingCode || "",
                services: buildServiceName(data.services, data.serviceName),
                status: data.status || "Đã xác nhận"
            };

        case ZALO_EVENTS.APPOINTMENT_CANCELLED:
            // Mẫu: Hủy lịch
            return {
                customer_name: data.customerName || "Quý khách",
                date: data.appointmentDate,
                booking_code: data.bookingCode || "",
                services: buildServiceName(data.services, data.serviceName),
                status: data.status || "Đã bị hủy",
            };

        case ZALO_EVENTS.BIRTHDAY:
            // Mẫu: Chúc mừng sinh nhật
            return {
                customer_name: data.customerName || "Quý khách",
            };

        default:
            throw new Error(`Chưa có cấu trúc tham số cho sự kiện: ${eventType}`);
    }
};