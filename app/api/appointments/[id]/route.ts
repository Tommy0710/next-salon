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

        // Only recalculate financial breakdown if services, discount, or staff changed
        let subtotal = existingAppointment.subtotal || 0;
        let tax = existingAppointment.tax || 0;
        let totalAmount = existingAppointment.totalAmount || 0;
        let totalCommission = existingAppointment.commission || 0;

        const servicesChanged = cleanBody.services && JSON.stringify(cleanBody.services) !== JSON.stringify(existingAppointment.services);
        const discountChanged = cleanBody.discount !== undefined && cleanBody.discount !== (existingAppointment.discount || 0);
        const staffChanged = cleanBody.staff && cleanBody.staff !== existingAppointment.staff;

        if (servicesChanged || discountChanged || staffChanged) {
            // Recalculate financial breakdown only when relevant fields change
            subtotal = services.reduce((acc: number, s: any) => acc + s.price, 0);
            tax = subtotal * (taxRate / 100);
            totalAmount = (subtotal + tax) - discount;

            // Commission logic
            const staff = await Staff.findById(staffId);
            const staffRate = staff?.commissionRate || 0;

            totalCommission = 0;
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
        }
        // 1. KIỂM TRA TRẠNG THÁI CÓ THAY ĐỔI KHÔNG TRƯỚC KHI LƯU
        const isStatusChanged = cleanBody.status && cleanBody.status !== existingAppointment.status;
        const newStatus = cleanBody.status;
        const sendZalo = cleanBody.sendZalo || false;

        const appointment = await Appointment.findByIdAndUpdate(id, {
            ...cleanBody,
            bookingCode,
            ...(servicesChanged || discountChanged || staffChanged ? {
                subtotal,
                tax,
                totalAmount,
                commission: totalCommission
            } : {})
        }, { new: true });

        // Populate customer separately to avoid issues
        const populatedAppointment = await Appointment.findById(appointment._id).populate('customer').populate('staff');

        // If updated to confirmed or completed, check if invoice exists, if not create one
        if (populatedAppointment && (populatedAppointment.status === 'confirmed' || populatedAppointment.status === 'completed')) {
            initModels();
            const existingInvoice = await Invoice.findOne({ appointment: id });
            if (!existingInvoice) {
                try {
                    const settings = await Settings.findOne();
                    const taxRate = settings?.taxRate || 0;
                    // Use the appointment's already calculated values instead of recalculating
                    const subtotal = populatedAppointment.subtotal || 0;
                    const tax = populatedAppointment.tax || 0;
                    const totalAmount = populatedAppointment.totalAmount || 0;
                    const discount = populatedAppointment.discount || 0;
                    const commission = populatedAppointment.commission || 0;

                    // Ensure services array exists and has proper structure
                    const servicesArray = Array.isArray(populatedAppointment.services) ? populatedAppointment.services : [];

                    if (servicesArray.length === 0) {
                        console.warn('⚠️ No services found for appointment', id);
                    }

                    const count = await Invoice.countDocuments();
                    const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

                    // Get staff rate for invoice
                    const invoiceStaff = populatedAppointment.staff ? await Staff.findById(populatedAppointment.staff._id || populatedAppointment.staff) : null;
                    const invoiceStaffRate = invoiceStaff?.commissionRate || 0;

                    const invoiceData = {
                        invoiceNumber,
                        customer: populatedAppointment.customer?._id || populatedAppointment.customer,
                        appointment: populatedAppointment._id,
                        items: servicesArray.map((s: any) => {
                            const serviceName = s.name || 'Unknown Service';
                            const servicePrice = s.price || 0;
                            return {
                                item: s.service?._id || s.service,
                                itemModel: 'Service',
                                name: serviceName,
                                price: servicePrice,
                                quantity: 1,
                                discount: 0,
                                total: servicePrice
                            };
                        }),
                        subtotal,
                        tax,
                        discount,
                        totalAmount,
                        amountPaid: 0,
                        status: populatedAppointment.status === 'completed' ? 'paid' : 'pending',
                        staff: populatedAppointment.staff?._id || populatedAppointment.staff,
                        staffAssignments: populatedAppointment.staff ? [{
                            staff: populatedAppointment.staff._id || populatedAppointment.staff,
                            percentage: invoiceStaffRate,
                            commission: commission
                        }] : [],
                        commission: commission,
                        date: populatedAppointment.date
                    };

                    console.log('📊 Creating invoice with data:', { invoiceNumber, appointmentId: id, itemsCount: servicesArray.length });
                    await Invoice.create(invoiceData);
                    console.log('✅ Invoice created successfully:', invoiceNumber);
                } catch (invoiceError: any) {
                    console.error('❌ Error creating invoice:', invoiceError?.message || invoiceError);
                    // Don't fail the whole request if invoice creation fails
                }
            } else if (populatedAppointment.status === 'completed' && existingInvoice.status !== 'paid') {
                // Update existing invoice status to paid if appointment is completed
                existingInvoice.status = 'paid';
                await existingInvoice.save();
            }
        }
        // ==========================================
        // 2. TRIGGER GỬI ZALO ZNS (GỌI QUA API TRUNG TÂM - NON-BLOCKING)
        // ==========================================
        // if (sendZalo && isStatusChanged && populatedAppointment.customer?.phone) {
        //     let eventType = '';

        //     // Xác định loại sự kiện dựa trên trạng thái mới
        //     if (newStatus === 'confirmed') {
        //         eventType = 'appointment_confirmed';
        //     } else if (newStatus === 'cancelled') {
        //         eventType = 'appointment_cancelled';
        //     }

        //     if (eventType) {
        //         // Gom tên các dịch vụ thành 1 chuỗi (VD: "Massage 60p, Gội đầu")
        //         const servicesString = populatedAppointment.services.map((s: any) => s.name).join(', ');

        //         // 👉 Lấy URL gốc của server để gọi chéo API trong Next.js
        //         const baseUrl = new URL(request.url).origin;

        //         // Gọi ngầm (Fire and Forget) - Không dùng await để app không bị treo
        //         fetch(`${baseUrl}/api/zalo/zns`, {
        //             method: "POST",
        //             headers: { "Content-Type": "application/json" },
        //             body: JSON.stringify({
        //                 phone: populatedAppointment.customer.phone,
        //                 eventType: eventType,
        //                 payloadData: {
        //                     customerName: populatedAppointment.customer.name || "Quý khách",
        //                     appointmentDate: new Date(populatedAppointment.date).toLocaleDateString('vi-VN'),
        //                     appointmentTime: populatedAppointment.startTime,
        //                     serviceName: servicesString,
        //                     bookingCode: populatedAppointment.bookingCode || populatedAppointment._id.toString().slice(-6).toUpperCase()
        //                 }
        //             })
        //         })
        //             .then(res => res.json())
        //             .then(data => {
        //                 if (!data.success) console.log("Cảnh báo API Zalo ZNS:", data.error || data.message);
        //             })
        //             .catch(err => console.error("Lỗi bất ngờ khi gọi API Zalo ZNS:", err));
        //     }
        // }

        return NextResponse.json({ success: true, data: populatedAppointment });
    } catch (error: any) {
        console.error('PUT appointment error:', error);
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
