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
        const qrAccount = searchParams.get("qrAccount"); // <-- LẤY THAM SỐ LỌC TỪ FRONTEND

        // 🔴 BẢO MẬT: CHẶN TRUY CẬP NẾU LÀ STAFF NHƯNG KHÔNG CÓ QR THỨ 2
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

        // Khởi tạo bộ lọc chung (theo ngày)
        const query: any = {
            date: { $gte: start, $lte: end }
        };

        // 🔴 BỘ LỌC TÀI KHOẢN QR
        if (qrAccount) {
            // Frontend truyền bankDetails dưới dạng `${qr.bankName} | ${qr.accountNumber} | ${qr.name}`
            // Nên chúng ta dùng $regex để tìm những giao dịch có chứa số tài khoản này
            query.bankDetails = { $regex: qrAccount, $options: 'i' };

            // LƯU Ý: Nếu trong Model Purchase hoặc Expense của bạn KHÔNG CÓ field `bankDetails`,
            // bạn cần đảm bảo thêm field này vào lúc lưu dữ liệu, hoặc sửa lại tên field cho khớp.
        }

        // Calculate Totals
        // 1. Sales (Invoices) 
        const invoiceStats = await Invoice.aggregate([
            { $match: { ...query, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalCollected: { $sum: "$amountPaid" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 2. Purchases
        const purchaseStats = await Purchase.aggregate([
            { $match: { ...query, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // 3. Expenses
        const expenseStats = await Expense.aggregate([
            { $match: query },
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