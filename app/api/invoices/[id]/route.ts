import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Appointment from '@/models/Appointment';
import Customer from "@/models/Customer";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { id } = await params;
        const invoice = await Invoice.findById(id).populate('customer').populate('staffAssignments.staff');
        if (!invoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch invoice" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        initModels();
        const { id } = await params;

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'edit');
        if (permissionError) return permissionError;

        const body = await request.json();

        const oldInvoice = await Invoice.findById(id);
        if (!oldInvoice) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        // Cập nhật Hóa đơn trước
        let invoice = await Invoice.findByIdAndUpdate(id, body, { new: true });

        // ========================================================
        // 🌟 LUỒNG XỬ LÝ SONG SONG KHI HÓA ĐƠN ĐƯỢC THANH TOÁN
        // ========================================================
        if (body.status === 'paid' && oldInvoice.status !== 'paid') {
            const backgroundTasks: Promise<any>[] = [];

            // 1. ĐỒNG BỘ TRẠNG THÁI LỊCH HẸN
            if (oldInvoice.appointment) {
                backgroundTasks.push(
                    Appointment.findByIdAndUpdate(oldInvoice.appointment, { status: 'completed' })
                );
            }

            // 2. XỬ LÝ KHÁCH HÀNG (Điểm thưởng & Ví) TRONG 1 TRUY VẤN
            if (invoice.customer) {
                backgroundTasks.push((async () => {
                    const customer = await Customer.findById(invoice.customer);
                    if (customer) {
                        const customerUpdates: any = { $inc: {} };

                        // A. Tính toán Điểm thưởng & Tổng chi tiêu
                        const pointsToGain = Math.floor(invoice.totalAmount / 10);
                        if (pointsToGain > 0) {
                            customerUpdates.$inc.loyaltyPoints = pointsToGain;
                            customerUpdates.$inc.totalPurchases = invoice.totalAmount;
                        }

                        // B. Tính toán Biến động Ví (Top-up & Deduct)
                        const walletDeduct = invoice.walletUsed || 0;
                        const preAmountAdded = (invoice.items || [])
                            .filter((it: any) => it.productType === 'PRE_AMOUNT')
                            .reduce((sum: number, it: any) => sum + (it.total || 0), 0);

                        const delta = preAmountAdded - walletDeduct;
                        let newBalance = customer.walletBalance || 0;

                        if (delta !== 0) {
                            newBalance = Math.max(0, newBalance + delta);
                            customerUpdates.walletBalance = newBalance;

                            // Lưu trữ số dư sau thanh toán vào Invoice
                            await Invoice.findByIdAndUpdate(id, { walletBalanceAfter: newBalance });
                            invoice.walletBalanceAfter = newBalance;
                        }

                        // Dọn dẹp object $inc nếu rỗng để tránh lỗi MongoDB
                        if (Object.keys(customerUpdates.$inc).length === 0) {
                            delete customerUpdates.$inc;
                        }

                        // C. Thực thi cập nhật Khách hàng 1 lần duy nhất
                        if (Object.keys(customerUpdates).length > 0) {
                            await Customer.findByIdAndUpdate(invoice.customer, customerUpdates);
                        }
                    }
                })());
            }

            // Chạy đồng thời các tiến trình để giảm thiểu thời gian chờ (Latency)
            await Promise.all(backgroundTasks);
        }

        // Log Activity
        await logActivity({
            req: request,
            action: 'update',
            resource: 'Invoice',
            resourceId: id,
            details: `Updated invoice ${invoice.invoiceNumber}. Status: ${invoice.status}`
        });

        return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
        console.error("API Error Invoice PUT:", error);
        return NextResponse.json({ success: false, error: "Failed to update invoice" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'delete');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;
        await Invoice.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete invoice" }, { status: 500 });
    }
}