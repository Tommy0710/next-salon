import { NextResponse } from 'next/server';
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Appointment from "@/models/Appointment";
import Customer from "@/models/Customer";
import Service from "@/models/Service";
import ServiceCategory from "@/models/ServiceCategory";
import { ZALO_EVENTS, buildTemplateData } from "@/lib/zalo-payloads";
import crypto from 'crypto';

// In-memory deduplication cache (ngăn webhook gọi multiple times cùng lúc)
const webhookCache = new Map<string, { id: string; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds

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
        // LAYER 1: IN-MEMORY DEDUPLICATION (Ngăn gọi song song)
        // ==========================================
        const webhookFingerprint = crypto
            .createHash('sha256')
            .update(`${customer_phone}-${date}-${time}-${total_amount}`)
            .digest('hex');

        const cachedResult = webhookCache.get(webhookFingerprint);
        if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
            console.log("🔄 Webhook đã xử lý gần đây (in-memory cache):", cachedResult.id);
            return NextResponse.json({
                success: true,
                message: "Webhook already processed",
                appointmentId: cachedResult.id,
                isDuplicate: true,
                cached: true
            }, { status: 200 });
        }

        // ==========================================
        // LAYER 2: DATABASE DEDUPLICATION (Kiểm tra trong 10 phút gần nhất)
        // ==========================================
        // Trước tiên tìm customer
        let customer = await Customer.findOne({ phone: customer_phone });
        
        // Nếu customer tồn tại, kiểm tra appointment trong 10 phút gần nhất
        if (customer) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const existingAppointment = await Appointment.findOne({
                customer: customer._id,
                date: {
                    $gte: new Date(`${date}T00:00:00Z`),
                    $lt: new Date(`${date}T23:59:59Z`)
                },
                startTime: time,
                createdAt: { $gte: tenMinutesAgo }
            });

            if (existingAppointment) {
                console.log("⚠️ Appointment đã tồn tại (DB check):", existingAppointment._id);
                webhookCache.set(webhookFingerprint, {
                    id: existingAppointment._id.toString(),
                    timestamp: Date.now()
                });
                return NextResponse.json({
                    success: true,
                    message: "Appointment already exists",
                    appointmentId: existingAppointment._id,
                    customerId: customer._id,
                    isDuplicate: true
                }, { status: 200 });
            }
        }

        // ==========================================
        // BƯỚC 1: XỬ LÝ KHÁCH HÀNG (Tạo mới nếu chưa có)
        // ==========================================
        if (!customer) {
            customer = await Customer.create({
                name: `${customer_first_name || ''} ${customer_last_name || ''}`.trim() || 'Khách Web',
                phone: customer_phone,
                email: customer_email || ""
            });
            console.log("👤 Đã tạo Khách hàng mới:", customer.name);
        } else {
            console.log("👤 Khách hàng đã tồn tại:", customer.name);
        }

        // ==========================================
        // BƯỚC 2: XỬ LÝ DỊCH VỤ (Tạo mới nếu chưa có)
        // ==========================================
        const rawServiceName = typeof services === 'string' && services.trim().length > 0
            ? services.split(':')[0].trim()
            : 'Dịch vụ từ Website';
        
        let serviceDoc = await Service.findOne({ 
            name: { $regex: new RegExp(`^${rawServiceName}$`, 'i') } 
        });

        if (!serviceDoc) {
            let defaultCategory = await ServiceCategory.findOne({ name: 'Website Bookings' });
            if (!defaultCategory) {
                defaultCategory = await ServiceCategory.create({
                    name: 'Website Bookings',
                    description: 'Danh mục tự động tạo cho các dịch vụ từ Website'
                });
            }
            let estimatedDuration = 60;
            const durationMatch = rawServiceName.match(/(\d+)\s*phút/i);
            if (durationMatch) {
                estimatedDuration = parseInt(durationMatch[1]);
            }

            serviceDoc = await Service.create({
                name: rawServiceName,
                price: total_amount || 0,
                duration: estimatedDuration,
                description: 'Tự động tạo từ Webhook Website',
                category: defaultCategory._id
            });
            console.log("💆‍♀️ Đã tạo Dịch vụ mới:", serviceDoc.name);
        } else {
            console.log("💆‍♀️ Dịch vụ đã tồn tại:", serviceDoc.name);
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

// ==========================================
// CACHE CLEANUP HANDLER (Prevent memory leaks)
// ==========================================
// Automatically clean up expired entries from the in-memory cache every 5 minutes
setInterval(() => {
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, value] of webhookCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            webhookCache.delete(key);
            expiredCount++;
        }
    }
    
    // Only log if there were expired entries
    if (expiredCount > 0) {
        console.log(`🧹 Cleared ${expiredCount} expired webhook cache entries. Current cache size: ${webhookCache.size}`);
    }
}, 5 * 60 * 1000); // Every 5 minutes