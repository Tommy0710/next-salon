import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Purchase from "@/models/Purchase";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import Settings from "@/models/Settings";
import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const qrAccount = searchParams.get("qrAccount"); // Nhận tham số lọc QR từ Frontend

        // 🔴 BẢO MẬT: Chặn truy cập nếu là Staff nhưng hệ thống chưa có QR thứ 2
        if (qrAccount === 'RESTRICTED_ACCESS_NO_QR_FOUND') {
            return NextResponse.json({
                success: true,
                data: {
                    sales: { totalSales: 0, totalCollected: 0, count: 0 },
                    purchases: { totalPurchases: 0, totalPaid: 0, count: 0 },
                    expenses: { totalExpenses: 0, count: 0 },
                    netProfit: 0,
                    cashFlow: 0
                }
            });
        }

        const settings = await Settings.findOne({}, { timezone: 1 }).lean();
        const timezone = settings?.timezone || "UTC";

        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDateParam || defaultRange.startDate,
            endDateParam || defaultRange.endDate,
            timezone
        );

        // Khởi tạo bộ lọc chung theo thời gian
        const baseQuery: any = {
            date: { $gte: start, $lte: end }
        };

        // 🔴 BỘ LỌC TÀI KHOẢN QR CHO INVOICE
        const invoiceQuery: any = { ...baseQuery, status: { $ne: 'cancelled' } };
        if (qrAccount) {
            // Tìm các hóa đơn có chuỗi bankDetails chứa số tài khoản được chỉ định
            invoiceQuery.bankDetails = { $regex: qrAccount, $options: 'i' };
        }

        // Tính toán doanh thu (Sales)
        const invoiceStats = await Invoice.aggregate([
            { $match: invoiceQuery },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalCollected: { $sum: "$amountPaid" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Tính toán nhập hàng (Purchases)
        const purchaseStats = await Purchase.aggregate([
            { $match: { ...baseQuery, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Tính toán chi phí (Expenses)
        const expenseStats = await Expense.aggregate([
            { $match: baseQuery },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const sales = invoiceStats[0] || { totalSales: 0, totalCollected: 0, count: 0 };
        const purchases = purchaseStats[0] || { totalPurchases: 0, totalPaid: 0, count: 0 };
        const expenses = expenseStats[0] || { totalExpenses: 0, count: 0 };

        const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses;
        const cashFlow = sales.totalCollected - purchases.totalPaid - expenses.totalExpenses;

        return NextResponse.json({
            success: true,
            data: {
                sales,
                purchases,
                expenses,
                netProfit,
                cashFlow
            }
        });
    } catch (error) {
        console.error("API Error Financial Report:", error);
        return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
    }
}