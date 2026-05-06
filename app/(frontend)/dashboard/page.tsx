import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Invoice from '@/models/Invoice';
import Appointment from '@/models/Appointment';
import Product from '@/models/Product';
import Settings from '@/models/Settings';
import Role from '@/models/Role';
import { formatCurrency } from '@/lib/currency';
import StatCard from '@/components/dashboard/StatCard';
import CustomerChart from '@/components/dashboard/CustomerChart';
import {
  DollarSign,
  AlertTriangle,
  Calendar,
  Users,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import SalesChartSection from './_components/SalesChartSection';
import ServiceChartSection from './_components/ServiceChartSection';
import RecentActivitySection from './_components/RecentActivitySection';
import { ChartSkeleton, ActivitySkeleton } from './_components/Skeletons';

// Pure helper — extracts QR-based access control filter for financial queries
function buildFinancialFilter(
  reportPermission: any,
  settings: any,
): Record<string, unknown> {
  if (reportPermission?.view !== 'own') return {};

  const allowedQrCodes: string[] = reportPermission.allowedQrCodes ?? [];
  const allowedBankNames = (settings.qrCodes ?? [])
    .filter((qr: any) => allowedQrCodes.includes(qr.qrId))
    .map((qr: any) => `QR Code - ${qr.bankName}`);

  return {
    $or: [
      { paymentMethod: { $in: allowedBankNames } },
      { paymentQrId: { $in: allowedQrCodes } },
    ],
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  await connectToDB();
  initModels();

  // ── Fast parallel: auth-dependent meta (role + settings) ─────────────────
  const [userRole, storeSettings] = await Promise.all([
    Role.findById((session.user as any).roleId).select('permissions').lean(),
    Settings.findOne().select('currency qrCodes').lean(),
  ]);

  const settings = (storeSettings as any) || { currency: 'USD', qrCodes: [] };
  const reportPermission = (userRole as any)?.permissions?.reports;
  const financialFilter = buildFinancialFilter(reportPermission, settings);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // ── Parallel: all above-fold critical data ────────────────────────────────
  const [salesResult, customerResult, apptResult, lowStockCount] = await Promise.all([
    // Today's revenue + order count — single aggregation
    Invoice.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd }, status: 'paid', ...financialFilter } },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, ordersCount: { $sum: 1 } } },
    ]),

    // Customer segmentation via $facet — single DB round-trip, replaces forEach loop
    Invoice.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd }, ...financialFilter } },
      {
        $facet: {
          // Invoices with no linked customer account → walk-ins
          walkIn: [{ $match: { customer: null } }, { $count: 'total' }],

          // Invoices with linked accounts — de-duplicated by customerId
          withAccount: [
            { $match: { customer: { $ne: null } } },
            { $group: { _id: '$customer' } },
            {
              $lookup: {
                from: 'customers',
                localField: '_id',
                foreignField: '_id',
                as: 'info',
                pipeline: [{ $project: { createdAt: 1 } }],
              },
            },
            { $unwind: { path: '$info', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                isNew: {
                  $cond: [
                    {
                      $and: [
                        { $gte: [{ $ifNull: ['$info.createdAt', new Date(0)] }, todayStart] },
                        { $lte: [{ $ifNull: ['$info.createdAt', new Date(0)] }, todayEnd] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                newCount: { $sum: '$isNew' },
                returnCount: { $sum: { $subtract: [1, '$isNew'] } },
              },
            },
          ],
        },
      },
    ]),

    // Appointment status breakdown — replaces forEach loop
    Appointment.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Low-stock product count
    Product.countDocuments({
      $expr: { $lte: ['$stock', '$alertQuantity'] },
      status: 'active',
    }),
  ]);

  // ── Shape aggregation results ─────────────────────────────────────────────
  const todaysSales = salesResult[0]?.totalSales ?? 0;
  const ordersToday = salesResult[0]?.ordersCount ?? 0;

  const facet = customerResult[0] ?? {};
  const walkIn = facet.walkIn?.[0]?.total ?? 0;
  const acct = facet.withAccount?.[0] ?? { newCount: 0, returnCount: 0 };
  const customerTotal = walkIn + acct.newCount + acct.returnCount;
  const customerChartData = [
    { name: 'Khách mới', value: acct.newCount },
    { name: 'Khách cũ', value: acct.returnCount },
    { name: 'Vãng lai', value: walkIn },
  ];

  const apptStats = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  for (const { _id, count } of apptResult) {
    if (_id === 'pending') apptStats.pending = count;
    else if (_id === 'confirmed') apptStats.confirmed = count;
    else if (_id === 'completed') apptStats.completed = count;
    else if (_id === 'cancelled') apptStats.cancelled = count;
    apptStats.total += count;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Xin chào,{' '}
            <span className="font-semibold text-primary-800 dark:text-primary-400">
              {session.user?.name || 'User'}
            </span>
            !{' '}
            {reportPermission?.view === 'own'
              ? 'Dưới đây là số liệu của bạn.'
              : 'Tổng quan hoạt động Spa hôm nay.'}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-900 text-white shadow-sm">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Row 1: Stat cards — renders immediately with critical data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Doanh thu hôm nay"
          value={formatCurrency(todaysSales)}
          icon={DollarSign}
          color="green"
          trendUp={true}
        />
        <StatCard
          title="Đơn hàng hoàn tất"
          value={ordersToday}
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
          trend={lowStockCount > 0 ? 'Cần nhập hàng' : 'Ổn định'}
          trendUp={lowStockCount === 0}
        />
      </div>

      {/* Row 2: Customer chart + Appointment status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Khách hàng hôm nay
            <span className="ml-auto bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 py-1 px-3 rounded-full text-sm">
              {customerTotal} khách
            </span>
          </h3>
          <CustomerChart data={customerChartData} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Tình trạng lịch hẹn
            <span className="ml-auto bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 py-1 px-3 rounded-full text-sm">
              {apptStats.total} lịch
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/20 transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-500 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold">Chờ xác nhận</span>
              </div>
              <p className="text-3xl font-black text-yellow-900 dark:text-yellow-400">{apptStats.pending}</p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-900/20 transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-primary-800 dark:text-primary-500 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-semibold">Đã xác nhận</span>
              </div>
              <p className="text-3xl font-black text-primary-900 dark:text-primary-400">{apptStats.confirmed}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20 transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-500 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">Đã hoàn tất</span>
              </div>
              <p className="text-3xl font-black text-green-900 dark:text-green-400">{apptStats.completed}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 transition-all hover:shadow-md">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">Đã hủy</span>
              </div>
              <p className="text-3xl font-black text-gray-800 dark:text-gray-300">{apptStats.cancelled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Charts — streamed independently, non-blocking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<ChartSkeleton />}>
          <SalesChartSection financialFilter={financialFilter} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <ServiceChartSection financialFilter={financialFilter} />
        </Suspense>
      </div>

      {/* Row 4: Recent Activity — streamed */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivitySection financialFilter={financialFilter} />
      </Suspense>
    </div>
  );
}
