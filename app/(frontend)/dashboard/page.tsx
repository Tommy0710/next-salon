import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Product from '@/models/Product';
import Invoice from '@/models/Invoice';
import Appointment from '@/models/Appointment';
import Settings from '@/models/Settings';
import Role from '@/models/Role'; // 👉 Import thêm Model Role
import { getCurrencySymbol } from '@/lib/currency';
import StatCard from '@/components/dashboard/StatCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import SalesChart from '@/components/dashboard/SalesChart';
import ServiceChart from '@/components/dashboard/ServiceChart';
import { Package, DollarSign, AlertTriangle, Calendar, Users, ShoppingBag } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, format, startOfMonth } from 'date-fns';

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    await connectToDB();
    initModels();

    // 1. KIỂM TRA QUYỀN TRUY CẬP (ROLE-BASED ACCESS CONTROL)
    const userRole = await Role.findById((session.user as any).roleId).lean();
    const reportPermission = userRole?.permissions?.reports;

    // Nếu không có quyền xem báo cáo, có thể đẩy ra trang khác hoặc trả về UI rỗng
    // Tạm thời ở đây vẫn cho vào nhưng số liệu sẽ bị lọc
    if (!reportPermission || reportPermission.view === 'none') {
        // Bạn có thể redirect('/unauthorized') nếu muốn làm gắt
    }

    const storeSettings = await Settings.findOne() || { currency: 'USD', qrCodes: [] };
    const currencySymbol = getCurrencySymbol(storeSettings.currency);

    // Date Ranges
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const last30Days = startOfDay(subDays(new Date(), 30));

    // =========================================================
    // 2. CHUẨN BỊ BỘ LỌC DỮ LIỆU TÀI CHÍNH THEO QR CODE (LỌC KÉP)
    // =========================================================
    const allowedQrCodes = reportPermission?.allowedQrCodes || [];

    // Mặc định Query là rỗng (Admin xem tất cả)
    let financialFilter: any = {};

    // Nếu là nhân viên chỉ được xem "own"
    if (reportPermission?.view === 'own') {
        // 2a. Lấy tên ngân hàng dự phòng cho hóa đơn cũ
        const allowedBankNames = (storeSettings.qrCodes || [])
            .filter((qr: any) => allowedQrCodes.includes(qr.qrId))
            .map((qr: any) => `QR Code - ${qr.bankName}`);

        // 2b. Điều kiện lọc kép: Hoặc là Tiền mặt/Tên cũ, Hoặc là QR ID mới
        financialFilter = {
            $or: [
                { paymentMethod: { $in: allowedBankNames } }, // Vớt lại hóa đơn cũ
                { paymentQrId: { $in: allowedQrCodes } }      // Lọc hóa đơn mới
            ]
        };
    }

    // =========================================================
    // 3. FETCH STATS (ÁP DỤNG BỘ LỌC)
    // =========================================================

    // -- PRODUCTS -- (Sản phẩm thường dùng chung, ít khi phân quyền theo QR, nhưng nếu cần có thể lọc)
    const productsCount = await Product.countDocuments({ status: "active" });
    const lowStockCount = await Product.countDocuments({
        $expr: { $lte: ["$stock", "$alertQuantity"] },
        status: "active"
    });

    // -- FINANCIALS (Hóa đơn hôm nay) --
    const todaysInvoices = await Invoice.find({
        date: { $gte: todayStart, $lte: todayEnd },
        status: "paid",
        ...financialFilter // 👉 Áp dụng bộ lọc tại đây
    });
    const todaysSales = todaysInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const ordersToday = todaysInvoices.length;

    // -- APPOINTMENTS -- (Lịch hẹn cũng có thể lọc theo QR nếu muốn, ở đây tạm lọc theo Staff nếu cần, hiện tại giữ chung)
    // Nếu bạn muốn Lịch hẹn cũng bị giới hạn, hãy lọc theo staffId của session.user
    const appointmentsToday = await Appointment.countDocuments({
        date: { $gte: todayStart, $lte: todayEnd },
        status: { $in: ['confirmed', 'completed'] }
    });

    // -- SERVICE STATS (Top dịch vụ 30 ngày) --
    const monthInvoices = await Invoice.find({
        date: { $gte: last30Days, $lte: todayEnd },
        status: "paid",
        ...financialFilter // 👉 Áp dụng bộ lọc tại đây
    }).lean(); // Thêm .lean() cho nhẹ

    const serviceStats: Record<string, number> = {};
    monthInvoices.forEach(inv => {
        (inv.items || []).forEach((item: any) => {
            if (item.itemModel === 'Service') {
                serviceStats[item.name] = (serviceStats[item.name] || 0) + item.total;
            }
        });
    });

    const serviceChartData = Object.entries(serviceStats)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);

    // -- SALES CHART DATA (Doanh thu 7 ngày qua) --
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const s = startOfDay(d);
        const e = endOfDay(d);

        // 👉 Áp dụng bộ lọc tại đây
        const dailyInvoices = await Invoice.find({
            date: { $gte: s, $lte: e },
            status: "paid",
            ...financialFilter
        }).select('totalAmount');

        const dailyTotal = dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        chartData.push({ name: format(d, 'EEE'), sales: dailyTotal });
    }

    // -- RECENT ACTIVITY --
    // Lấy hóa đơn gần nhất NHƯNG phải thuộc về quyền hạn của nhân viên
    const recentInvoices = await Invoice.find({
        ...financialFilter // 👉 Áp dụng bộ lọc tại đây
    }).sort({ createdAt: -1 }).limit(5).populate('customer', 'name').lean();

    const formattedActivity = recentInvoices.map(inv => ({
        id: inv._id.toString(),
        type: "sale" as const,
        product: `Invoice #${inv.invoiceNumber}`,
        quantity: 1,
        time: format(inv.createdAt, 'hh:mm a')
    }));

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500">
                        Welcome back, <span className="font-semibold text-blue-800">{session.user?.name || 'User'}</span>!
                        {reportPermission?.view === 'own' ? " Here are your assigned metrics." : " Here is what's happening today."}
                    </p>
                </div>
                <div className="mt-4 md:mt-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900 text-white">
                        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* <StatCard
                    title="Hôm nay thu về"
                    value={`${currencySymbol}${todaysSales.toLocaleString()}`}
                    icon={DollarSign}
                    color="green"
                    trendUp={true}
                /> */}
                <StatCard
                    title="Lịch hẹn hôm nay"
                    value={appointmentsToday.toString()}
                    icon={Calendar}
                    color="blue"
                    trend="Tổng đài"
                    trendUp={true}
                />
                {/* Chỉ Admin hoặc người có quyền xem kho mới nên quan tâm Low Stock, nhưng tạm để chung */}
                {/* <StatCard
                    title="Sản phẩm sắp hết"
                    value={lowStockCount.toString()}
                    icon={AlertTriangle}
                    color="red"
                    trend={lowStockCount > 0 ? "Cần nhập hàng" : "Ổn định"}
                    trendUp={lowStockCount === 0}
                /> */}
                <StatCard
                    title="Đơn hàng hoàn tất"
                    value={ordersToday.toString()}
                    icon={ShoppingBag}
                    color="purple"
                    trend="Hôm nay"
                    trendUp={true}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SalesChart data={chartData} />
                <ServiceChart data={serviceChartData} />
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Giao dịch gần đây</h3>
                <RecentActivity activities={formattedActivity} />
            </div>
        </div>
    );
}