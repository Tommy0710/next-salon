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
import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
    try {
        await connectToDB();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        // 🔴 LẤY THAM SỐ LỌC QR TỪ FRONTEND GỬI LÊN
        const qrAccount = searchParams.get("qrAccount");

        const settings = await Settings.findOne({}, { timezone: 1 }).lean();
        const timezone = settings?.timezone || "UTC";
        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDate || defaultRange.startDate,
            endDate || defaultRange.endDate,
            timezone
        );

        // 🔴 BẢO MẬT 1: NẾU STAFF BỊ CHẶN VÌ CHƯA CÀI ĐẶT QR THỨ 2
        if (qrAccount === 'RESTRICTED_ACCESS_NO_QR_FOUND') {
            let emptyData: any = [];
            if (type === 'profit') emptyData = { totalRevenue: 0, totalExpenses: 0, totalPayroll: 0, totalPurchases: 0, netProfit: 0 };
            if (type === 'daily') emptyData = { totalSales: 0, totalCollected: 0, payments: {}, totalExpenses: 0, invoiceCount: 0 };
            return NextResponse.json({ success: true, data: emptyData });
        }

        // 🔴 BẢO MẬT 2: TẠO QUERY LỌC CHUNG CHO CÁC GIAO DỊCH
        const transactionQuery: any = {
            date: { $gte: start, $lte: end }
        };

        // Nếu có qrAccount (tức là Staff đang xem), chỉ lấy các giao dịch có liên quan đến số tài khoản này
        if (qrAccount) {
            transactionQuery.bankDetails = { $regex: qrAccount, $options: 'i' };
        }

        let data: any = null;

        switch (type) {
            case "sales":
                // Lọc Sales Report theo transactionQuery
                data = await Invoice.find(transactionQuery).populate('customer staff');
                break;

            case "services":
                // Lọc Service Report theo transactionQuery
                const invoices = await Invoice.find(transactionQuery);
                const serviceStats: any = {};

                invoices.forEach(inv => {
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
                // Lọc Staff Performance theo transactionQuery
                const staffInvoices = await Invoice.find(transactionQuery)
                    .populate('staff staffAssignments.staff')
                    .populate({ path: 'appointment', populate: { path: 'staff' } });

                const staffStats: any = {};

                staffInvoices.forEach(inv => {
                    if (inv.staffAssignments && inv.staffAssignments.length > 0) {
                        inv.staffAssignments.forEach((assignment: any) => {
                            const s = assignment.staff;
                            if (s) {
                                const id = s._id.toString();
                                if (!staffStats[id]) {
                                    staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
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
                            staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
                        }
                        staffStats[id].sales += 1;
                        staffStats[id].revenue += inv.totalAmount;
                        staffStats[id].commission += (inv.commission || 0);
                    } else if ((inv as any).appointment?.staff) {
                        const apt: any = (inv as any).appointment;
                        const s: any = apt.staff;
                        const id = s._id.toString();
                        if (!staffStats[id]) {
                            staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
                        }
                        staffStats[id].sales += 1;
                        staffStats[id].revenue += inv.totalAmount;
                        staffStats[id].commission += ((inv as any).commission || apt.commission || 0);
                    }
                });
                data = Object.values(staffStats).sort((a: any, b: any) => b.revenue - a.revenue);
                break;

            case "customers":
                // Customer Growth: Không cần lọc theo QR vì khách hàng là dữ liệu chung
                const customers = await Customer.find({
                    createdAt: { $gte: start, $lte: end }
                });
                data = customers;
                break;

            case "inventory":
                // Inventory Report: Không cần lọc theo QR vì kho hàng là dữ liệu chung
                data = await Product.find({}).sort({ stock: 1 });
                break;

            case "expenses":
                // Lọc Expense Report theo transactionQuery
                data = await Expense.find(transactionQuery);
                break;

            case "profit":
                // Profit Report: Phức tạp hơn vì liên quan nhiều bảng
                const revInvoices = await Invoice.find(transactionQuery);
                const expExpenses = await Expense.find(transactionQuery);

                // 🔴 BẢO MẬT: Nếu bị giới hạn QR (Staff xem), ẨN TOÀN BỘ TIỀN LƯƠNG NHÂN VIÊN KHÁC
                let payPayroll: any[] = [];
                if (!qrAccount) {
                    payPayroll = await Payroll.find({
                        createdAt: { $gte: start, $lte: end }
                    });
                }

                const purPurchases = await Purchase.find({ ...transactionQuery, status: { $ne: 'cancelled' } });

                const totalRevenue = revInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
                const totalExpenses = expExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                const totalPayroll = payPayroll.reduce((sum, pay) => sum + pay.totalAmount, 0);
                const totalPurchases = purPurchases.reduce((sum, pur) => sum + pur.totalAmount, 0);

                data = {
                    totalRevenue,
                    totalExpenses,
                    totalPayroll,
                    totalPurchases,
                    netProfit: totalRevenue - totalExpenses - totalPayroll - totalPurchases
                };
                break;

            case "daily":
                // Lọc Daily Closing Report theo transactionQuery
                const dailyInvoices = await Invoice.find(transactionQuery);
                const dailyExpenses = await Expense.find(transactionQuery);

                const payments: any = { Cash: 0, Card: 0, Wallet: 0 };
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

            default:
                return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}