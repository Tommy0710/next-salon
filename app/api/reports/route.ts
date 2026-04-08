import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import {
    Invoice,
    Expense,
    Appointment,
    Customer,
    Product,
    Service,
    Staff,
    Payroll,
    Purchase
} from "@/lib/initModels";
import Settings from "@/models/Settings";
import Role from "@/models/Role"; // 👉 Thêm Role
import { auth } from "@/auth"; // 👉 Thêm auth
import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
    try {
        await connectToDB();

        // 1. KIỂM TRA QUYỀN TRUY CẬP
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        const userRole = await Role.findById((session.user as any).roleId).lean();
        const reportPermission = userRole?.permissions?.reports;

        if (!reportPermission || reportPermission.view === 'none') {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        
        const settings = await Settings.findOne().lean();
        const timezone = settings?.timezone || "UTC";
        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDate || defaultRange.startDate,
            endDate || defaultRange.endDate,
            timezone
        );

        // 2. CHUẨN BỊ QUERY LỌC THEO QR (GIỐNG FINANCIAL REPORT)
        const invoiceQuery: any = {
            date: { $gte: start, $lte: end }
        };

        // Lấy mảng QR ra một biến riêng để chiều lòng TypeScript
        const allowedQrCodes = reportPermission.allowedQrCodes || [];

        if (reportPermission.view === 'own') {
            // 1. DỰ PHÒNG CHO HÓA ĐƠN CŨ: Vẫn lấy tên ngân hàng để khớp với các hóa đơn tạo trước đây
            const allowedBankNames = (settings.qrCodes || [])
                .filter((qr: any) => allowedQrCodes.includes(qr.qrId))
                .map((qr: any) => `QR Code - ${qr.bankName}`);

            invoiceQuery.$or = [
                { paymentMethod: { $in: ['Cash', 'Tiền mặt', ...allowedBankNames] } },
                
                { paymentQrId: { $in: allowedQrCodes } }
            ];
        }

        let data: any = null;

        switch (type) {
            case "sales":
                // Sử dụng invoiceQuery đã được lọc
                data = await Invoice.find(invoiceQuery).populate('customer staff').lean();
                break;

            case "services":
                const serviceInvoices = await Invoice.find(invoiceQuery).lean();
                const serviceStats: any = {};
                serviceInvoices.forEach(inv => {
                    inv.items.forEach((item: any) => {
                        if (item.itemModel === 'Service') {
                            const name = item.name;
                            if (!serviceStats[name]) {
                                serviceStats[name] = { name, count: 0, revenue: 0 };
                            }
                            serviceStats[name].count += item.quantity;
                            serviceStats[name].revenue += item.total;
                        }
                    });
                });
                data = Object.values(serviceStats).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "staff":
                const staffInvoices = await Invoice.find(invoiceQuery)
                    .populate('staff staffAssignments.staff')
                    .populate({ path: 'appointment', populate: { path: 'staff' } })
                    .lean();

                const staffStats: any = {};
                staffInvoices.forEach(inv => {
                    if (inv.staffAssignments && inv.staffAssignments.length > 0) {
                        inv.staffAssignments.forEach((assignment: any) => {
                            const s = assignment.staff;
                            if (s) {
                                const id = s._id.toString();
                                if (!staffStats[id]) {
                                    staffStats[id] = { name: s.name, sales: 0, commission: 0, revenue: 0 };
                                }
                                staffStats[id].sales += 1;
                                staffStats[id].revenue += inv.totalAmount;
                                staffStats[id].commission += (assignment.commission || 0);
                            }
                        });
                    } else if (inv.staff) {
                        const s = inv.staff;
                        const id = s._id.toString();
                        if (!staffStats[id]) {
                            staffStats[id] = { name: s.name, sales: 0, commission: 0, revenue: 0 };
                        }
                        staffStats[id].sales += 1;
                        staffStats[id].revenue += inv.totalAmount;
                        staffStats[id].commission += (inv.commission || 0);
                    }
                });
                data = Object.values(staffStats).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "profit":
                const revInvoices = await Invoice.find(invoiceQuery).lean();
                const expExpenses = await Expense.find({ date: { $gte: start, $lte: end } }).lean();
                // Purchases và Payroll thường mặc định là Admin xem, nhưng ta vẫn lọc ngày cho đúng
                const purPurchases = await Purchase.find({ date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } }).lean();

                const totalRevenue = revInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                const totalExpenses = expExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                const totalPurchases = purPurchases.reduce((sum, pur) => sum + pur.totalAmount, 0);

                data = {
                    totalRevenue,
                    totalExpenses,
                    totalPurchases,
                    netProfit: totalRevenue - totalExpenses - totalPurchases
                };
                break;

            case "daily":
                const dailyInvoices = await Invoice.find(invoiceQuery).lean();
                const dailyExpenses = await Expense.find({ date: { $gte: start, $lte: end } }).lean();

                const payments: any = {};
                dailyInvoices.forEach(inv => {
                    payments[inv.paymentMethod] = (payments[inv.paymentMethod] || 0) + inv.amountPaid;
                });

                data = {
                    totalSales: dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
                    totalCollected: dailyInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
                    payments,
                    totalExpenses: dailyExpenses.reduce((sum, exp) => sum + exp.amount, 0),
                    invoiceCount: dailyInvoices.length
                };
                break;

            case "customers":
                data = await Customer.find({ createdAt: { $gte: start, $lte: end } }).lean();
                break;

            case "inventory":
                data = await Product.find({}).sort({ stock: 1 }).lean();
                break;

            default:
                return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}