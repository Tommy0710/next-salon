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

        // Normalize discount: support both old (number) and new ({ type, value }) format
        let discount: { type: 'percentage' | 'fixed'; value: number };
        if (cleanBody.discount !== undefined) {
            if (typeof cleanBody.discount === 'object' && cleanBody.discount !== null) {
                discount = {
                    type: cleanBody.discount.type === 'fixed' ? 'fixed' : 'percentage',
                    value: Math.max(0, Number(cleanBody.discount.value) || 0),
                };
            } else {
                // Legacy: number sent as percentage value
                discount = { type: 'percentage', value: Math.max(0, Number(cleanBody.discount) || 0) };
            }
        } else {
            const ex = existingAppointment.discount as any;
            discount = typeof ex === 'object' && ex !== null
                ? { type: ex.type || 'percentage', value: ex.value || 0 }
                : { type: 'percentage', value: Number(ex) || 0 };
        }

        const bookingCode = cleanBody.bookingCode || existingAppointment.bookingCode || `BOOK-${new Date().getFullYear()}-${existingAppointment._id.toString().slice(-6).toUpperCase()}`;

        // Only recalculate financial breakdown if services, discount, or staff changed
        let subtotal = existingAppointment.subtotal || 0;
        let tax = existingAppointment.tax || 0;
        let totalAmount = existingAppointment.totalAmount || 0;
        let totalCommission = existingAppointment.commission || 0;

        const servicesChanged = cleanBody.services && JSON.stringify(cleanBody.services) !== JSON.stringify(existingAppointment.services);
        const exDiscount = existingAppointment.discount as any;
        const exDiscountStr = JSON.stringify(typeof exDiscount === 'object' ? exDiscount : { type: 'percentage', value: exDiscount || 0 });
        const discountChanged = cleanBody.discount !== undefined && JSON.stringify(discount) !== exDiscountStr;
        const staffChanged = cleanBody.staff && cleanBody.staff !== existingAppointment.staff;

        if (servicesChanged || discountChanged || staffChanged) {
            // Recalculate financial breakdown only when relevant fields change
            subtotal = services.reduce((acc: number, s: any) => acc + s.price, 0);
            tax = subtotal * (taxRate / 100);
            const discountAmount = discount.type === 'fixed'
                ? Math.min(discount.value, subtotal)
                : subtotal * (discount.value / 100);
            totalAmount = Math.max(0, subtotal + tax - discountAmount);

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
            discount,   // always persist as object
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
                    const invoiceSettings = await Settings.findOne();
                    const subtotal = populatedAppointment.subtotal || 0;
                    const tax = populatedAppointment.tax || 0;
                    const totalAmount = populatedAppointment.totalAmount || 0;
                    const commission = populatedAppointment.commission || 0;

                    // Compute discountAmount from the discount object
                    const apptDiscount = populatedAppointment.discount as any;
                    const apptDiscountType = apptDiscount?.type || 'percentage';
                    const apptDiscountValue = apptDiscount?.value || 0;
                    const discountAmount = apptDiscountType === 'fixed'
                        ? Math.min(apptDiscountValue, subtotal)
                        : subtotal * (apptDiscountValue / 100);

                    const servicesArray = Array.isArray(populatedAppointment.services) ? populatedAppointment.services : [];

                    if (servicesArray.length === 0) {
                        console.warn('⚠️ [Invoice] No services found for appointment', id);
                    }

                    // Validate items: each must have a valid item (ObjectId)
                    const invoiceItems = servicesArray
                        .filter((s: any) => {
                            const itemId = s.service?._id || s.service;
                            if (!itemId) {
                                console.warn('⚠️ [Invoice] Skipping service with null/undefined id:', s);
                                return false;
                            }
                            return true;
                        })
                        .map((s: any) => ({
                            item: s.service?._id || s.service,
                            itemModel: 'Service',
                            name: s.name || 'Unknown Service',
                            price: s.price || 0,
                            quantity: 1,
                            discount: 0,
                            total: s.price || 0,
                        }));

                    // Get staff commission rate
                    const invoiceStaff = populatedAppointment.staff
                        ? await Staff.findById(populatedAppointment.staff._id || populatedAppointment.staff)
                        : null;
                    const invoiceStaffRate = invoiceStaff?.commissionRate || 0;

                    const invoiceStatus = populatedAppointment.status === 'completed' ? 'paid' : 'pending';

                    // Safe invoice number generation with retry loop (prevents E11000 duplicate key)
                    const year = new Date().getFullYear();
                    let createdInvoice = null;
                    const MAX_RETRIES = 5;

                    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                        try {
                            const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).select('invoiceNumber').lean();
                            let nextNum = 1;
                            if (lastInvoice && (lastInvoice as any).invoiceNumber) {
                                const parts = ((lastInvoice as any).invoiceNumber as string).split('-');
                                const lastNum = parseInt(parts[parts.length - 1] || '0', 10);
                                if (!isNaN(lastNum)) nextNum = lastNum + 1;
                            }
                            if (attempt > 0) nextNum += attempt; // offset on retry to avoid collision

                            const invoiceNumber = `INV-${year}-${nextNum.toString().padStart(5, '0')}`;

                            const invoiceData = {
                                invoiceNumber,
                                customer: populatedAppointment.customer?._id || populatedAppointment.customer,
                                appointment: populatedAppointment._id,
                                bookingCode: populatedAppointment.bookingCode,
                                items: invoiceItems,
                                subtotal,
                                tax,
                                discount: discountAmount,  // Invoice stores the monetary amount
                                totalAmount,
                                amountPaid: 0,
                                status: invoiceStatus,
                                staff: populatedAppointment.staff?._id || populatedAppointment.staff,
                                staffAssignments: populatedAppointment.staff ? [{
                                    staff: populatedAppointment.staff._id || populatedAppointment.staff,
                                    percentage: invoiceStaffRate,
                                    commission: commission
                                }] : [],
                                commission: commission,
                                date: populatedAppointment.date
                            };

                            console.log('📊 [Invoice] Creating:', { invoiceNumber, appointmentId: id, itemsCount: invoiceItems.length, totalAmount, status: invoiceStatus });
                            createdInvoice = await Invoice.create(invoiceData);
                            console.log('✅ [Invoice] Created successfully:', invoiceNumber, '(attempt', attempt + 1, ')');
                            break;
                        } catch (dupErr: any) {
                            if (dupErr?.code === 11000 && attempt < MAX_RETRIES - 1) {
                                console.warn(`⚠️ [Invoice] Duplicate key on attempt ${attempt + 1}, retrying...`);
                                continue;
                            }
                            throw dupErr;
                        }
                    }

                    if (!createdInvoice) {
                        console.error(`❌ [Invoice] Failed after ${MAX_RETRIES} attempts for appointment ${id}`);
                    }

                } catch (invoiceError: any) {
                    console.error('❌ [Invoice] Error creating invoice:', {
                        message: invoiceError?.message,
                        code: invoiceError?.code,
                        errors: invoiceError?.errors ? JSON.stringify(invoiceError.errors) : undefined,
                        appointmentId: id,
                    });
                    // Don't fail the whole request if invoice creation fails
                }
            } else if (populatedAppointment.status === 'completed' && existingInvoice.status !== 'paid') {
                // Update existing invoice status to paid if appointment is completed
                existingInvoice.status = 'paid';
                await existingInvoice.save();
                console.log(`✅ [Invoice] Updated ${existingInvoice.invoiceNumber} → paid`);
            } else {
                console.log(`ℹ️ [Invoice] Already exists (${existingInvoice.invoiceNumber}), skipping.`);
            }
        }

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
