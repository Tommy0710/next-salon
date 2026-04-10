import { NextResponse } from 'next/server';
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Appointment from "@/models/Appointment";
import Customer from "@/models/Customer";
import Service from "@/models/Service"; // 👉 Import thêm Model Service
import ServiceCategory from "@/models/ServiceCategory";
import { ZALO_EVENTS, buildTemplateData } from "@/lib/zalo-payloads";

export async function POST(request: Request) {
    try {
        await connectToDB();
        initModels();

        const body = await request.json();
        
        // 1. Map dữ liệu từ Webhook
        const {
            date,
            time, // Ví dụ: '20:00'
            customer_first_name,
            customer_last_name,
            customer_phone,
            customer_email,
            services, // Ví dụ: 'Massage toàn thân 60 phút: 20:00-21:00 '
            total_amount,
            source
        } = body;

        // ==========================================
        // KIỂM TRA TRÙNG LẶP (Idempotency Check)
        // ==========================================
        // Nếu appointment với customer_phone + date + startTime đã tồn tại
        // thì return existing appointment (tránh tạo duplicate)
        const existingAppointment = await Appointment.findOne({
            'customer.phone': customer_phone,
            date: new Date(date),
            startTime: time
        }).populate('customer');

        if (existingAppointment) {
            console.log("⚠️ Appointment đã tồn tại:", existingAppointment._id);
            return NextResponse.json({
                success: true,
                message: "Appointment already exists",
                appointmentId: existingAppointment._id,
                customerId: existingAppointment.customer?._id,
                isDuplicate: true
            }, { status: 200 });
        }

        // ==========================================
        // BƯỚC 1: XỬ LÝ KHÁCH HÀNG (Tạo mới nếu chưa có)
        // ==========================================
        let customer = await Customer.findOne({ phone: customer_phone });
        if (!customer) {
            customer = await Customer.create({
                name: `${customer_first_name || ''} ${customer_last_name || ''}`.trim() || 'Khách Web',
                phone: customer_phone,
                email: customer_email || ""
            });
            console.log("👤 Đã tạo Khách hàng mới:", customer.name);
        }

        // ==========================================
        // BƯỚC 2: XỬ LÝ DỊCH VỤ (Tạo mới nếu chưa có)
        // ==========================================
        // Dữ liệu từ web thường có kèm giờ (VD: 'Massage 60 phút: 20:00-21:00'). 
        // Ta cần cắt bỏ phần giờ phía sau dấu ':' để lấy đúng tên dịch vụ.
        const rawServiceName = typeof services === 'string' && services.trim().length > 0
            ? services.split(':')[0].trim()
            : 'Dịch vụ từ Website';
        
        // Dò tìm dịch vụ trong DB (không phân biệt hoa thường)
        let serviceDoc = await Service.findOne({ 
            name: { $regex: new RegExp(`^${rawServiceName}$`, 'i') } 
        });

        // Nếu chưa có dịch vụ này trong hệ thống -> Tự động tạo mới
        if (!serviceDoc) {
            // Tìm danh mục mặc định cho web, nếu không có thì tạo mới
            let defaultCategory = await ServiceCategory.findOne({ name: 'Website Bookings' });
            if (!defaultCategory) {
                defaultCategory = await ServiceCategory.create({
                    name: 'Website Bookings',
                    description: 'Danh mục tự động tạo cho các dịch vụ từ Website'
                });
            }
            // Thử bóc tách thời gian (duration) nếu trong tên có chữ "60 phút", "90 phút"...
            let estimatedDuration = 60; // Mặc định 60 phút
            const durationMatch = rawServiceName.match(/(\d+)\s*phút/i);
            if (durationMatch) {
                estimatedDuration = parseInt(durationMatch[1]);
            }

            serviceDoc = await Service.create({
                name: rawServiceName,
                price: total_amount || 0, // Lấy giá từ webhook làm giá gốc
                duration: estimatedDuration,
                description: 'Tự động tạo từ Webhook Website',
                category: defaultCategory._id
            });
            console.log("💆‍♀️ Đã tạo Dịch vụ mới:", serviceDoc.name);
        }

        // Tính toán giờ kết thúc (endTime) dựa trên duration
        const [hours, minutes] = time.split(':').map(Number);
        const startDate = new Date(date);
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate.getTime() + serviceDoc.duration * 60000);
        const endTimeString = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        // ==========================================
        // BƯỚC 3: TẠO LỊCH HẸN (Gắn ID Customer và ID Service)
        // ==========================================
        const bookingCode = `BOOK-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const appointmentPayload = {
            customer: customer._id,
            date: new Date(date),
            startTime: time,       // Chuẩn hóa theo trường của Appointment model
            endTime: endTimeString,
            status: 'pending',     // Lịch từ web luôn là chờ xác nhận
            source: source || 'Website',
            totalAmount: total_amount ?? serviceDoc.price ?? 0,
            totalDuration: serviceDoc.duration,
            notes: typeof services === 'string' ? services : '',       // Lưu lại chuỗi gốc của web để đối chiếu nếu cần
            bookingCode,
            services: [{
                service: serviceDoc._id,
                name: serviceDoc.name,
                price: serviceDoc.price,
                duration: serviceDoc.duration
            }]
        };

        console.log("[WebhookBooking] request body:", {
            date,
            time,
            customer_first_name,
            customer_last_name,
            customer_phone,
            customer_email,
            services,
            total_amount,
            source
        });
        console.log("[WebhookBooking] customer:", customer ? { _id: customer._id, name: customer.name, phone: customer.phone, email: customer.email } : null);
        console.log("[WebhookBooking] serviceDoc:", serviceDoc ? { _id: serviceDoc._id, name: serviceDoc.name, duration: serviceDoc.duration, price: serviceDoc.price } : null);
        console.log("[WebhookBooking] appointmentPayload:", appointmentPayload);

        const newAppointment = await Appointment.create(appointmentPayload);

        console.log("✅ Đã tạo Lịch hẹn tự động:", newAppointment._id);

        // ==========================================
        // TRIGGER GỬI ZALO ZNS KHI TẠO APPOINTMENT TỪ WEBHOOK (NON-BLOCKING)
        // ==========================================
        if (customer.phone && newAppointment.status === 'pending') {
            // Gom tên các dịch vụ thành 1 chuỗi
            const servicesString = newAppointment.services.map((s: any) => s.name).join(', ');

            // Lấy URL gốc của server để gọi chéo API trong Next.js
            const baseUrl = new URL(request.url).origin;

            // Gọi ngầm (Fire and Forget) - Không dùng await để app không bị treo
            fetch(`${baseUrl}/api/zalo/zns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: customer.phone,
                    eventType: ZALO_EVENTS.APPOINTMENT_REMINDER, // Webhook tạo appointment pending, gửi reminder
                    payloadData: {
                        customerName: customer.name || "Quý khách",
                        appointmentDate: new Date(newAppointment.date).toLocaleDateString('vi-VN'),
                        appointmentTime: newAppointment.startTime,
                        serviceName: servicesString
                    }
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (!data.success) console.log("Cảnh báo API Zalo ZNS (webhook):", data.error || data.message);
                })
                .catch(err => console.error("Lỗi bất ngờ khi gọi API Zalo ZNS (webhook):", err));
        }

        return NextResponse.json({ 
            success: true, 
            appointmentId: newAppointment._id,
            customerId: customer._id,
            serviceId: serviceDoc._id
        }, { status: 201 });

    } catch (error: any) {
        console.error("❌ Lỗi xử lý Webhook:", {
            error: error?.message || error,
            stack: error?.stack,
        });
        return NextResponse.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
    }
}