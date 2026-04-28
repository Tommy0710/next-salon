import { NextResponse } from 'next/server';
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Appointment from "@/models/Appointment";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
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

        console.log("📥 [WEBHOOK] Received payload:", JSON.stringify(body, null, 2));

        // 1. Map dữ liệu CHÍNH XÁC từ Payload của WordPress
        const {
            booking_date,
            booking_time,
            full_name,
            phone,
            email,
            note,
            services,
            total_amount,
            source
        } = body;

        // ==========================================
        // SỬA LỖI INVALID DATE: Bóc tách ngày an toàn
        // ==========================================
        if (!booking_date || typeof booking_date !== 'string' || !booking_date.includes('-')) {
            throw new Error(`Định dạng ngày không hợp lệ: ${booking_date}`);
        }
        const [year, month, day] = booking_date.split('-').map(Number);
        const appointmentDate = new Date(year, month - 1, day);

        if (Number.isNaN(appointmentDate.getTime())) {
            throw new Error(`Không thể khởi tạo ngày từ giá trị: ${booking_date}`);
        }

        const appointmentDayStart = new Date(appointmentDate);
        appointmentDayStart.setHours(0, 0, 0, 0);
        const appointmentDayEnd = new Date(appointmentDate);
        appointmentDayEnd.setHours(23, 59, 59, 999);

        // ==========================================
        // LAYER 1: IN-MEMORY DEDUPLICATION (Chống trùng lặp)
        // ==========================================
        const webhookFingerprint = crypto
            .createHash('sha256')
            .update(`${phone}-${booking_date}-${booking_time}-${total_amount}`)
            .digest('hex');

        const cachedResult = webhookCache.get(webhookFingerprint);
        if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
            console.log("🔄 Webhook đã xử lý gần đây:", cachedResult.id);
            return NextResponse.json({ success: true, appointmentId: cachedResult.id, isDuplicate: true }, { status: 200 });
        }

        // ==========================================
        // LAYER 2: DATABASE DEDUPLICATION
        // ==========================================
        let customer = null;
        if (phone && phone.trim() !== '') {
            customer = await Customer.findOne({ phone: phone.trim() });
        }

        if (customer) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const existingAppointment = await Appointment.findOne({
                customer: customer._id,
                date: { $gte: appointmentDayStart, $lt: appointmentDayEnd },
                startTime: booking_time,
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
                name: full_name?.trim() || 'Khách Web',
                phone: phone?.trim() || '0000000000',
                email: email || ""
            });
            console.log("👤 Đã tạo Khách hàng mới:", customer.name);
        }

        // ==========================================
        // BƯỚC 2: XỬ LÝ MẢNG DỊCH VỤ THÔNG MINH
        // ==========================================
        let parsedServices: any[] = [];

        // WP Gửi sang dạng Array (Vì bạn không dùng implode)
        if (Array.isArray(services)) {
            parsedServices = services;
        } else if (typeof services === 'string' && services.trim() !== '') {
            // Dự phòng nếu lỗi plugin tự nối thành chuỗi phẩy
            parsedServices = services.split(',').map(s => s.trim());
        }

        if (parsedServices.length === 0) {
            parsedServices = [{ name: 'Dịch vụ Website', price: Number(total_amount) || 0, duration: 60 }];
        }

        const serviceEntries: any[] = [];
        let totalDuration = 0;
        let calculatedTotalAmount = 0;

        for (const item of parsedServices) {
            let serviceName = 'Dịch vụ Web';
            let durationMinutes = 60;
            let itemPrice = 0;

            // Xử lý linh hoạt 2 trường hợp: Item là chuỗi HOẶC Item là Object (do WP plugin định nghĩa)
            if (typeof item === 'string') {
                serviceName = item.split(':')[0].trim();
                const durationMatch = serviceName.match(/(\d+)\s*phút/i);
                if (durationMatch) durationMinutes = parseInt(durationMatch[1]);
            } else if (typeof item === 'object' && item !== null) {
                serviceName = (item.name || item.title || 'Dịch vụ Web').trim();
                itemPrice = Number(item.price) || 0;

                // Xử lý duration nếu WP trả về '01:00' hoặc 60
                if (item.duration) {
                    if (typeof item.duration === 'number') durationMinutes = item.duration;
                    else if (typeof item.duration === 'string' && item.duration.includes(':')) {
                        const [h, m] = item.duration.split(':').map(Number);
                        durationMinutes = (h || 0) * 60 + (m || 0);
                    } else durationMinutes = parseInt(item.duration) || 60;
                } else {
                    const durationMatch = serviceName.match(/(\d+)\s*phút/i);
                    if (durationMatch) durationMinutes = parseInt(durationMatch[1]);
                }
            }

            if (!serviceName) continue;

            // Tìm hoặc tạo dịch vụ trong DB
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
                service: serviceDoc._id.toString(),
                name: serviceDoc.name,
                price: itemPrice > 0 ? itemPrice : serviceDoc.price,
                duration: durationMinutes
            });

            totalDuration += durationMinutes;
            calculatedTotalAmount += (itemPrice > 0 ? itemPrice : serviceDoc.price);
        }

        // Khớp Delta (Nếu giá trị WP gửi sang cao hơn/thấp hơn tính toán, nhét phần dư vào dịch vụ cuối)
        const finalAmount = Number(total_amount) || calculatedTotalAmount;
        if (finalAmount > 0 && serviceEntries.length > 0) {
            const sumOfServices = serviceEntries.reduce((sum, s) => sum + s.price, 0);
            const delta = finalAmount - sumOfServices;
            // Chỉ bù trừ delta nếu việc trừ tiền không làm dịch vụ cuối bị giá trị âm vô lý
            if (delta !== 0 && serviceEntries[serviceEntries.length - 1].price + delta >= 0) {
                serviceEntries[serviceEntries.length - 1].price += delta;
            }
        }

        // ==========================================
        // BƯỚC 3: TÍNH THỜI GIAN & TẠO LỊCH
        // ==========================================
        const [hours, minutes] = booking_time.split(':').map(Number);
        const startDate = new Date(appointmentDate);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + totalDuration * 60000);
        const endTimeString = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

        const bookingCode = `BOOK-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const servicesNotes = serviceEntries.map(s => `${s.name}`).join(' + ');
        // Gom Note khách tự viết với Note dịch vụ
        const finalNotes = note ? `Khách ghi: ${note}\n(Dịch vụ: ${servicesNotes})` : servicesNotes;

        const appointmentPayload = {
            customer: customer._id.toString(),
            date: appointmentDate,
            startTime: booking_time,
            endTime: endTimeString,
            status: 'confirmed',
            source: source || 'Website',
            totalAmount: finalAmount,
            subtotal: finalAmount,
            tax: 0,
            discount: 0,
            commission: 0,
            totalDuration: totalDuration,
            notes: finalNotes,
            bookingCode,
            services: serviceEntries
        };

        const newAppointment = await Appointment.create(appointmentPayload);
        webhookCache.set(webhookFingerprint, { id: newAppointment._id.toString(), timestamp: Date.now() });

        console.log("✅ Đã tạo Lịch hẹn tự động:", newAppointment._id);

        // ==========================================
        // BƯỚC 4: TẠO HÓA ĐƠN CHỜ THANH TOÁN
        // ==========================================
        const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
        let nextInvoiceNum = 1;
        if (lastInvoice?.invoiceNumber) {
            const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
            if (!isNaN(lastNum)) nextInvoiceNum = lastNum + 1;
        }
        const invoiceNumber = `INV-${new Date().getFullYear()}-${nextInvoiceNum.toString().padStart(5, '0')}`;

        const invoiceItems = serviceEntries.map(s => ({
            item: s.service,
            itemModel: 'Service' as const,
            name: s.name,
            price: s.price,
            quantity: 1,
            discount: 0,
            total: s.price,
        }));

        const newInvoice = await Invoice.create({
            invoiceNumber,
            customer: customer._id,
            appointment: newAppointment._id,
            bookingCode,
            items: invoiceItems,
            subtotal: finalAmount,
            tax: 0,
            discount: 0,
            totalAmount: finalAmount,
            amountPaid: 0,
            paymentMethod: 'Cash',
            status: 'pending',
            walletUsed: 0,
            staffAssignments: [],
            commission: 0,
            notes: finalNotes,
            date: appointmentDate,
        });

        console.log("🧾 Đã tạo Hóa đơn chờ thanh toán:", newInvoice._id, invoiceNumber);

        // ==========================================
        // GỬI ZALO (NON-BLOCKING)
        // ==========================================
        if (customer.phone && newAppointment.status === 'confirmed') {
            const servicesString = newAppointment.services.map((s: any) => s.name).join(', ');
            const baseUrl = new URL(request.url).origin;

            fetch(`${baseUrl}/api/zalo/zns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: customer.phone,
                    eventType: 'appointment_confirmed', // Hoặc có thể là APPOINTMENT_REMINDER tùy file payload của bạn
                    payloadData: {
                        customerName: customer.name || "Quý khách",
                        appointmentDate: new Date(newAppointment.date).toLocaleDateString('vi-VN'),
                        appointmentTime: newAppointment.startTime,
                        serviceName: servicesString
                    }
                })
            }).catch(err => console.error("Lỗi Zalo ZNS:", err));
        }

        return NextResponse.json({ success: true, appointmentId: newAppointment._id, invoiceId: newInvoice._id, invoiceNumber }, { status: 201 });

    } catch (error: any) {
        console.error("❌ [WEBHOOK] Lỗi xử lý:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of webhookCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) webhookCache.delete(key);
    }
}, 5 * 60 * 1000);