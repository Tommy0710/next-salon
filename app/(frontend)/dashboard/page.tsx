import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Product from '@/models/Product';
import Invoice from '@/models/Invoice';
import Appointment from '@/models/Appointment';
import Settings from '@/models/Settings';
import Role from '@/models/Role';
import { getCurrencySymbol } from '@/lib/currency';
import StatCard from '@/components/dashboard/StatCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import SalesChart from '@/components/dashboard/SalesChart';
import ServiceChart from '@/components/dashboard/ServiceChart';
import CustomerChart from '@/components/dashboard/CustomerChart'; // 👉 Import Biểu đồ khách hàng
import { Package, DollarSign, AlertTriangle, Calendar, Users, ShoppingBag, Clock, CheckCircle, XCircle } from 'lucide-react';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    await connectToDB();
    initModels();

    const userRole = await Role.findById((session.user as any).roleId).lean();
    const reportPermission = userRole?.permissions?.reports;

    const storeSettings = await Settings.findOne() || { currency: 'USD', qrCodes: [] };
    const currencySymbol = getCurrencySymbol(storeSettings.currency);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const last30Days = startOfDay(subDays(new Date(), 30));

    // Lọc Kép QR Code
    const allowedQrCodes = reportPermission?.allowedQrCodes || [];
    let financialFilter: any = {};

    if (reportPermission?.view === 'own') {
        const allowedBankNames = (storeSettings.qrCodes || [])
            .filter((qr: any) => allowedQrCodes.includes(qr.qrId))
            .map((qr: any) => `QR Code - ${qr.bankName}`);

        financialFilter = {
            $or: [
                { paymentMethod: { $in: allowedBankNames } },
                { paymentQrId: { $in: allowedQrCodes } }
            ]
        };
    }

    // =========================================================
    // 1. DỮ LIỆU SẢN PHẨM & TÀI CHÍNH
    // =========================================================
    const lowStockCount = await Product.countDocuments({
        $expr: { $lte: ["$stock", "$alertQuantity"] },
        status: "active"
    });

    // Lấy TẤT CẢ hóa đơn hôm nay để phân tích khách hàng
    const allTodaysInvoices = await Invoice.find({
        date: { $gte: todayStart, $lte: todayEnd },
        ...financialFilter
    }).populate('customer').lean();

    const todaysSales = allTodaysInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const ordersToday = allTodaysInvoices.filter(inv => inv.status === 'paid').length;

    // =========================================================
    // 2. PHÂN TÍCH KHÁCH HÀNG HÔM NAY (MỚI - CŨ - VÃNG LAI)
    // =========================================================
    let newCust = 0;
    let returnCust = 0;
    let walkIn = 0;
    const uniqueCustomers = new Set();

    allTodaysInvoices.forEach(inv => {
        if (!inv.customer) {
            // Hóa đơn không gắn tài khoản khách -> Vãng lai
            walkIn++;
        } else {
            const cust = inv.customer as any;
            const custId = cust._id.toString();

            // Chống trùng lặp (1 khách làm 2 dịch vụ vẫn đếm là 1)
            if (!uniqueCustomers.has(custId)) {
                uniqueCustomers.add(custId);
                const custCreatedAt = new Date(cust.createdAt);

                // Trùng ngày tạo tài khoản với hôm nay -> Khách mới
                if (custCreatedAt >= todayStart && custCreatedAt <= todayEnd) {
                    newCust++;
                } else {
                    returnCust++; // Tạo từ trước -> Khách cũ quay lại
                }
            }
        }
    });

    const customerChartData = [
        { name: 'Khách mới', value: newCust },
        { name: 'Khách cũ', value: returnCust },
        { name: 'Vãng lai', value: walkIn }
    ];

    // =========================================================
    // 3. PHÂN TÍCH TRẠNG THÁI LỊCH HẸN
    // =========================================================
    const todaysAppointments = await Appointment.find({
        date: { $gte: todayStart, $lte: todayEnd }
    }).lean();

    const apptStats = {
        total: todaysAppointments.length,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
    };

    todaysAppointments.forEach(app => {
        if (app.status === 'pending') apptStats.pending++;
        else if (app.status === 'confirmed') apptStats.confirmed++;
        else if (app.status === 'completed') apptStats.completed++;
        else if (app.status === 'cancelled') apptStats.cancelled++;
    });

    // =========================================================
    // 4. CHARTS & RECENT ACTIVITY
    // =========================================================
    const monthInvoices = await Invoice.find({
        date: { $gte: last30Days, $lte: todayEnd },
        status: "paid",
        ...financialFilter
    }).lean();

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

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dailyInvoices = await Invoice.find({
            date: { $gte: startOfDay(d), $lte: endOfDay(d) },
            status: "paid",
            ...financialFilter
        }).select('totalAmount');

        const dailyTotal = dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        chartData.push({ name: format(d, 'EEE'), sales: dailyTotal });
    }

    const recentInvoices = await Invoice.find({
        ...financialFilter
    }).sort({ createdAt: -1 }).limit(5).populate('customer', 'name').lean();

    const formattedActivity = recentInvoices.map(inv => ({
        id: inv._id.toString(),
        type: "sale" as const,
        product: `Hóa đơn #${inv.invoiceNumber}`,
        quantity: 1,
        time: format(inv.createdAt, 'HH:mm')
    }));

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500">
                        Xin chào, <span className="font-semibold text-blue-800">{session.user?.name || 'User'}</span>!
                        {reportPermission?.view === 'own' ? " Dưới đây là số liệu của bạn." : " Tổng quan hoạt động Spa hôm nay."}
                    </p>
                </div>
                <div className="mt-4 md:mt-0">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-900 text-white shadow-sm">
                        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* DÒNG 1: CHỈ SỐ CƠ BẢN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Doanh thu hôm nay"
                    value={`${currencySymbol}${todaysSales.toLocaleString()}`}
                    icon={DollarSign}
                    color="green"
                    trendUp={true}
                />
                <StatCard
                    title="Đơn hàng hoàn tất"
                    value={ordersToday.toString()}
                    icon={ShoppingBag}
                    color="purple"
                    trend="Hôm nay"
                    trendUp={true}
                />
                <StatCard
                    title="Sản phẩm sắp hết"
                    value={lowStockCount.toString()}
                    icon={AlertTriangle}
                    color="red"
                    trend={lowStockCount > 0 ? "Cần nhập hàng" : "Ổn định"}
                    trendUp={lowStockCount === 0}
                />
            </div>

            {/* DÒNG 2: CHI TIẾT KHÁCH HÀNG & LỊCH HẸN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Block 1: Biểu đồ khách hàng */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Khách hàng hôm nay <span className="ml-auto bg-blue-50 text-blue-700 py-1 px-3 rounded-full text-sm">{uniqueCustomers.size + walkIn} khách</span>
                    </h3>
                    <CustomerChart data={customerChartData} />
                </div>

                {/* Block 2: Trạng thái Lịch hẹn */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Tình trạng lịch hẹn <span className="ml-auto bg-indigo-50 text-indigo-700 py-1 px-3 rounded-full text-sm">{apptStats.total} lịch</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-yellow-800 mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-semibold">Chờ xác nhận</span>
                            </div>
                            <p className="text-3xl font-black text-yellow-900">{apptStats.pending}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-blue-800 mb-2">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm font-semibold">Đã xác nhận</span>
                            </div>
                            <p className="text-3xl font-black text-blue-900">{apptStats.confirmed}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-green-800 mb-2">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-semibold">Đã hoàn tất</span>
                            </div>
                            <p className="text-3xl font-black text-green-900">{apptStats.completed}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <XCircle className="w-4 h-4" />
                                <span className="text-sm font-semibold">Đã hủy</span>
                            </div>
                            <p className="text-3xl font-black text-gray-800">{apptStats.cancelled}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DÒNG 3: BIỂU ĐỒ DOANH THU & DỊCH VỤ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SalesChart data={chartData} />
                <ServiceChart data={serviceChartData} />
            </div>

            {/* DÒNG 4: HOẠT ĐỘNG GẦN ĐÂY */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Giao dịch gần đây</h3>
                <RecentActivity activities={formattedActivity} />
            </div>
        </div>
    );
}