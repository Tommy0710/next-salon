import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Invoice from '@/models/Invoice';
import SalesChart from '@/components/dashboard/SalesChart';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface Props {
  financialFilter: Record<string, unknown>;
}

export default async function SalesChartSection({ financialFilter }: Props) {
  await connectToDB();
  initModels();

  const today = new Date();
  const rangeStart = startOfDay(subDays(today, 6));
  const rangeEnd = endOfDay(today);

  // Single aggregation replaces 7 sequential Invoice.find() calls
  const raw: { _id: string; sales: number }[] = await Invoice.aggregate([
    { $match: { date: { $gte: rangeStart, $lte: rangeEnd }, status: 'paid', ...financialFilter } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        sales: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDate = new Map(raw.map((r) => [r._id, r.sales]));

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return { name: format(d, 'EEE'), sales: byDate.get(format(d, 'yyyy-MM-dd')) ?? 0 };
  });

  return <SalesChart data={chartData} />;
}
