import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Purchase from "@/models/Purchase";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import Settings from "@/models/Settings";
import Role from "@/models/Role"; // 👉 Import thêm Role
import { getMonthDateRangeInTimezone, getUtcRangeForDateRange } from "@/lib/dateUtils";
import { auth } from "@/auth"; // 👉 Import auth để lấy session

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();

        // 1. Kiểm tra Quyền (Role) của người đang gọi API
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        const userRole = await Role.findById((session.user as any).roleId).lean();
        const reportPermission = userRole?.permissions?.reports;

        if (!reportPermission || reportPermission.view === 'none') {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Xác định xem có phải Super Admin không
        const isSuperAdmin = userRole?.name?.toLowerCase() === 'super admin' || userRole?.name?.toLowerCase() === 'super-admin';

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const settings = await Settings.findOne().lean();
        const timezone = settings?.timezone || "UTC";

        const defaultRange = getMonthDateRangeInTimezone(timezone);
        const { start, end } = getUtcRangeForDateRange(
            startDateParam || defaultRange.startDate,
            endDateParam || defaultRange.endDate,
            timezone
        );

        // 2. Query cơ bản theo ngày
        const invoiceQuery: any = {
            date: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' }
        };

        // 3. LOGIC LỌC PAYMENT METHOD
        // Super Admin: được xem tất cả payment methods bao gồm Cash
        // Các role khác: chỉ được xem QR codes được phép, KHÔNG bao gồm Cash
        if (!isSuperAdmin) {
            const allowedQrCodes = reportPermission.allowedQrCodes || [];
            
            if (allowedQrCodes.length > 0) {
                const allowedBankNames = settings.qrCodes
                    .filter((qr: any) => allowedQrCodes.includes(qr.qrId))
                    .map((qr: any) => `QR Code - ${qr.bankName}`);

                // Chỉ cho phép xem các QR được chỉ định (KHÔNG bao gồm Cash/Tiền mặt)
                invoiceQuery.paymentMethod = { $in: allowedBankNames };
            } else {
                // Nếu không có QR nào được phép, không cho xem invoice nào
                invoiceQuery.paymentMethod = { $in: [] };
            }
        }
        // Super Admin không cần filter paymentMethod - được xem tất cả

        // 4. Bắt đầu tính toán
        const invoiceStats = await Invoice.aggregate([
            { $match: invoiceQuery }, // Sử dụng query đã được lọc
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalCollected: { $sum: "$amountPaid" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const purchaseStats = await Purchase.aggregate([
            { $match: { date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const expenseStats = await Expense.aggregate([
            { $match: { date: { $gte: start, $lte: end } } },
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
            data: { sales, purchases, expenses, netProfit, cashFlow }
        });
    } catch (error) {
        console.error("API Error Financial Report:", error);
        return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
    }
}