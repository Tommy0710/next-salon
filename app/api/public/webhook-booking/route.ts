import { NextResponse } from 'next/server';
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Appointment from "@/models/Appointment";
import Customer from "@/models/Customer";
import Service from "@/models/Service";
import ServiceCategory from "@/models/ServiceCategory";
import { ZALO_EVENTS } from "@/lib/zalo-payloads";
import crypto from 'crypto';

// In-memory deduplication cache
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
            time,
            customer_first_name,
            customer_last_name,
            customer_phone,
            customer_email,
            services, // Mảng các object từ WordPress
            total_amount,
            source
        } = body;

        // ==========================================
        // SỬA LỖI INVALID DATE: Bóc tách ngày an toàn
        // ==========================================
        if (!date || typeof date !== 'string' || !date.includes('-')) {
            throw new Error(`Định dạng ngày không hợp lệ: ${date}`);
        }
        const [year, month, day] = date.split('-').map(Number);
        const appointmentDate = new Date(year, month - 1, day);
        
        if (Number.isNaN(appointmentDate.getTime())) {
            throw new Error(`Không thể khởi tạo ngày từ giá trị: ${date}`);
        }

        const appointmentDayStart = new Date(appointmentDate);
        appointmentDayStart.setHours(0, 0, 0, 0);
        const appointmentDayEnd = new Date(appointmentDate);
        appointmentDayEnd.setHours(23, 59, 59, 999);

        // ==========================================
        // LAYER 1: IN-MEMORY DEDUPLICATION
        // ==========================================
        const webhookFingerprint = crypto
            .createHash('sha256')
            .update(`${customer_phone}-${date}-${time}-${total_amount}`)
            .digest('hex');

        const cachedResult = webhookCache.get(webhookFingerprint);
        if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
            console.log("🔄 Webhook đã xử lý gần đây:", cachedResult.id);
            return NextResponse.json({ success: true, appointmentId: cachedResult.id, isDuplicate: true }, { status: 200 });
        }

        // ==========================================
        // LAYER 2: DATABASE DEDUPLICATION
        // ==========================================
        let customer = await Customer.findOne({ phone: customer_phone });
        
        if (customer) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const existingAppointment = await Appointment.findOne({
                customer: customer._id,
                date: { $gte: appointmentDayStart, $lt: appointmentDayEnd },
                startTime: time,
                createdAt: { $gte: tenMinutesAgo }
            });

            if (existingAppointment) {
                console.log("⚠️ Appointment đã tồn tại (DB check):", existingAppointment._id);
                webhookCache.set(webhookFingerprint, { id: existingAppointment._id.toString(), timestamp: Date.now() });
                return NextResponse.json({ success: true, appointmentId: existingAppointment._id, isDuplicate: true }, { status: 200 });
            }
        }

        // ==========================================
        // BƯỚC 1: XỬ LÝ KHÁCH HÀNG
        // ==========================================
        if (!customer) {
            customer = await Customer.create({
                name: `${customer_first_name || ''} ${customer_last_name || ''}`.trim() || 'Khách Web',
                phone: customer_phone,
                email: customer_email || ""
            });
            console.log("👤 Đã tạo Khách hàng mới:", customer.name);
        }

        // ==========================================
        // BƯỚC 2: XỬ LÝ MẢNG DỊCH VỤ VÀ GIÁ TIỀN
        // ==========================================
        let parsedServices = Array.isArray(services) ? services : [];
        const serviceEntries: any[] = [];
        let totalDuration = 0;
        let calculatedTotalAmount = 0;

        for (const item of parsedServices) {
            if (!item.name) continue;

            const serviceName = item.name.trim();
            let durationMinutes = 60;
            if (item.duration && typeof item.duration === 'string') {
                const [h, m] = item.duration.split(':').map(Number);
                durationMinutes = (h || 0) * 60 + (m || 0);
            }

            const itemPrice = Number(item.price) || 0;

            let serviceDoc = await Service.findOne({
                name: { $regex: new RegExp(`^${serviceName}$`, 'i') }
            });

            if (!serviceDoc) {
                let defaultCategory = await ServiceCategory.findOne({ name: 'Website Bookings' });
                if (!defaultCategory) {
                    defaultCategory = await ServiceCategory.create({ name: 'Website Bookings', description: 'Tự động tạo từ Webhook' });
                }
                serviceDoc = await Service.create({
                    name: serviceName,
                    price: itemPrice,
                    duration: durationMinutes,
                    category: defaultCategory._id
                });
            }

            serviceEntries.push({
                service: serviceDoc._id,
                name: serviceDoc.name,
                price: itemPrice,
                duration: durationMinutes,
                attendant: item.attendant || null
            });

            totalDuration += durationMinutes;
            calculatedTotalAmount += itemPrice;
        }

        // Xử lý Delta (Khớp tổng tiền)
        const finalAmount = Number(total_amount) || calculatedTotalAmount;
        if (finalAmount > 0 && serviceEntries.length > 0) {
            const sumOfServices = serviceEntries.reduce((sum, s) => sum + s.price, 0);
            const delta = finalAmount - sumOfServices;
            if (delta !== 0) {
                serviceEntries[serviceEntries.length - 1].price += delta;
            }
        }

        // Tính toán giờ kết thúc
        const [hours, minutes] = time.split(':').map(Number);
        const startDate = new Date(appointmentDate);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + totalDuration * 60000);
        const endTimeString = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        // ==========================================
        // BƯỚC 3: TẠO LỊCH HẸN
        // ==========================================
        const bookingCode = `BOOK-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const servicesNotes = serviceEntries.map(s => `${s.name} (${s.price.toLocaleString()}đ)`).join(' + ');

        const appointmentPayload = {
            customer: customer._id,
            date: appointmentDate,
            startTime: time,
            endTime: endTimeString,
            status: 'pending',
            source: source || 'Website',
            totalAmount: finalAmount,
            totalDuration: totalDuration,
            notes: servicesNotes,
            bookingCode,
            services: serviceEntries
        };

        const newAppointment = await Appointment.create(appointmentPayload);
        webhookCache.set(webhookFingerprint, { id: newAppointment._id.toString(), timestamp: Date.now() });

        console.log("✅ Đã tạo Lịch hẹn tự động:", newAppointment._id);

        // ==========================================
        // GỬI ZALO (NON-BLOCKING)
        // ==========================================
        if (customer.phone && newAppointment.status === 'pending') {
            const servicesString = newAppointment.services.map((s: any) => s.name).join(', ');
            const baseUrl = new URL(request.url).origin;

            fetch(`${baseUrl}/api/zalo/zns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: customer.phone,
                    eventType: ZALO_EVENTS.APPOINTMENT_REMINDER,
                    payloadData: {
                        customerName: customer.name || "Quý khách",
                        appointmentDate: new Date(newAppointment.date).toLocaleDateString('vi-VN'),
                        appointmentTime: newAppointment.startTime,
                        serviceName: servicesString
                    }
                })
            }).catch(err => console.error("Lỗi Zalo ZNS:", err));
        }

        return NextResponse.json({ success: true, appointmentId: newAppointment._id }, { status: 201 });

    } catch (error: any) {
        console.error("❌ Lỗi xử lý Webhook:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of webhookCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) webhookCache.delete(key);
    }
}, 5 * 60 * 1000);