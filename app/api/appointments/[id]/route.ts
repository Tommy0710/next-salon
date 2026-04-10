import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Invoice from "@/models/Invoice";
import Deposit from "@/models/Deposit";
import Settings from "@/models/Settings";
import Staff from "@/models/Staff";
import Service from "@/models/Service";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { sendZaloZNS } from "@/lib/zalo";
import { ZALO_EVENTS, buildTemplateData } from "@/lib/zalo-payloads";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'appointments', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { id } = await params;

        const appointment = await Appointment.findById(id)
            .populate('customer')
            .populate('staff');

        if (!appointment) {
            return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        return handleApiError('GET_APPOINTMENT', error);
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'appointments', 'edit');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;
        const body = await request.json();

        const initRes = initModels();
        const settings = await Settings.findOne();
        const taxRate = settings?.taxRate || 0;

        const existingAppointment = await Appointment.findById(id);
        if (!existingAppointment) {
            return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
        }

        const { _id, __v, createdAt, updatedAt, ...cleanBody } = body;

        // Robustness: Handle if status is accidentally sent as an object (e.g. from a React event)
        if (cleanBody.status && typeof cleanBody.status === 'object' && cleanBody.status.target) {
            cleanBody.status = cleanBody.status.target.value;
        }

        const services = cleanBody.services || existingAppointment.services;
        const staffId = cleanBody.staff || existingAppointment.staff;
        const discount = cleanBody.discount !== undefined ? cleanBody.discount : (existingAppointment.discount || 0);
        const bookingCode = cleanBody.bookingCode || existingAppointment.bookingCode || `BOOK-${new Date().getFullYear()}-${existingAppointment._id.toString().slice(-6).toUpperCase()}`;

        // Recalculate financial breakdown
        const subtotal = services.reduce((acc: number, s: any) => acc + s.price, 0);
        const tax = subtotal * (taxRate / 100);
        const totalAmount = (subtotal + tax) - discount;

        // Commission logic
        const staff = await Staff.findById(staffId);
        const staffRate = staff?.commissionRate || 0;

        let totalCommission = 0;
        for (const item of services) {
            const serviceId = item.service?._id || item.service;
            const service = await Service.findById(serviceId);
            const commType = service?.commissionType || 'percentage';
            const commValue = service?.commissionValue || staffRate;

            if (commType === 'percentage') {
                const shareOfTotal = subtotal > 0 ? (totalAmount * (item.price / subtotal)) : 0;
                totalCommission += (shareOfTotal * commValue) / 100;
            } else {
                totalCommission += commValue;
            }
        }
        // 1. KIỂM TRA TRẠNG THÁI CÓ THAY ĐỔI KHÔNG TRƯỚC KHI LƯU
        const isStatusChanged = cleanBody.status && cleanBody.status !== existingAppointment.status;
        const newStatus = cleanBody.status;

        const appointment = await Appointment.findByIdAndUpdate(id, {
            ...cleanBody,
            bookingCode,
            subtotal,
            tax,
            totalAmount,
            commission: totalCommission
        }, { new: true }).populate('customer');

        // If updated to confirmed or completed, check if invoice exists, if not create one
        if (appointment && (appointment.status === 'confirmed' || appointment.status === 'completed')) {
            initModels();
            const existingInvoice = await Invoice.findOne({ appointment: id });
            if (!existingInvoice) {
                const settings = await Settings.findOne();
                const taxRate = settings?.taxRate || 0;
                const subtotal = appointment.subtotal;
                const tax = appointment.tax;
                const totalAmount = appointment.totalAmount;
                const discount = appointment.discount || 0;

                const count = await Invoice.countDocuments();
                const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

                await Invoice.create({
                    invoiceNumber,
                    customer: appointment.customer,
                    appointment: appointment._id,
                    items: appointment.services.map((s: any) => ({
                        item: s.service,
                        itemModel: 'Service',
                        name: s.name,
                        price: s.price,
                        quantity: 1,
                        total: s.price
                    })),
                    subtotal,
                    tax,
                    discount,
                    totalAmount,
                    commission: totalCommission,
                    staff: appointment.staff,
                    staffAssignments: appointment.staff ? [{
                        staff: appointment.staff,
                        percentage: staffRate,
                        commission: totalCommission
                    }] : [],
                    status: appointment.status === 'completed' ? 'paid' : 'pending',
                    date: appointment.date
                });
            } else if (appointment.status === 'completed' && existingInvoice.status !== 'paid') {
                // Update existing invoice status to paid if appointment is completed
                existingInvoice.status = 'paid';
                await existingInvoice.save();
            }
        }
        // ==========================================
        // 2. TRIGGER GỬI ZALO ZNS (SMART & NON-BLOCKING)
        // ==========================================
        // ==========================================
        // 2. TRIGGER GỬI ZALO ZNS (GỌI QUA API TRUNG TÂM - NON-BLOCKING)
        // ==========================================
        if (isStatusChanged && appointment.customer?.phone) {
            let eventType = '';

            // Xác định loại sự kiện dựa trên trạng thái mới
            if (newStatus === 'confirmed') {
                eventType = 'appointment_confirmed';
            } else if (newStatus === 'cancelled') {
                eventType = 'appointment_cancelled';
            }

            if (eventType) {
                // Gom tên các dịch vụ thành 1 chuỗi (VD: "Massage 60p, Gội đầu")
                const servicesString = appointment.services.map((s: any) => s.name).join(', ');

                // 👉 Lấy URL gốc của server để gọi chéo API trong Next.js
                const baseUrl = new URL(request.url).origin;

                // Gọi ngầm (Fire and Forget) - Không dùng await để app không bị treo
                fetch(`${baseUrl}/api/zalo/zns`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: appointment.customer.phone,
                        eventType: eventType,
                        payloadData: {
                            customerName: appointment.customer.name || "Quý khách",
                            appointmentDate: new Date(appointment.date).toLocaleDateString('vi-VN'),
                            appointmentTime: appointment.startTime,
                            serviceName: servicesString,
                            bookingCode: appointment.bookingCode || appointment._id.toString().slice(-6).toUpperCase()
                        }
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (!data.success) console.log("Cảnh báo API Zalo ZNS:", data.error || data.message);
                    })
                    .catch(err => console.error("Lỗi bất ngờ khi gọi API Zalo ZNS:", err));
            }
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        return handleApiError('UPDATE_APPOINTMENT', error);
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'appointments', 'delete');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;

        // Cascade delete: deposits -> invoices -> appointment
        const linkedInvoices = await Invoice.find({ appointment: id }).select('_id');
        const invoiceIds = linkedInvoices.map((inv: any) => inv._id);

        if (invoiceIds.length > 0) {
            await Deposit.deleteMany({ invoice: { $in: invoiceIds } });
            await Invoice.deleteMany({ _id: { $in: invoiceIds } });
        }

        await Appointment.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleApiError('DELETE_APPOINTMENT', error);
    }
}
