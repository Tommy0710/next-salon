import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Invoice from '@/models/Invoice';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { format } from 'date-fns';

interface Props {
  financialFilter: Record<string, unknown>;
}

export default async function RecentActivitySection({ financialFilter }: Props) {
  await connectToDB();
  initModels();

  const invoices = await Invoice.find({ ...financialFilter })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('customer', 'name')
    .select('invoiceNumber createdAt')
    .lean();

  const activities = (invoices as any[]).map((inv) => ({
    id: inv._id.toString(),
    type: 'sale' as const,
    product: `Hóa đơn #${inv.invoiceNumber}`,
    quantity: 1,
    time: format(new Date(inv.createdAt), 'HH:mm'),
  }));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Giao dịch gần đây</h3>
      <RecentActivity activities={activities} />
    </div>
  );
}
