import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import Invoice from '@/models/Invoice';
import ServiceChart from '@/components/dashboard/ServiceChart';
import { startOfDay, endOfDay, subDays } from 'date-fns';

interface Props {
  financialFilter: Record<string, unknown>;
}

export default async function ServiceChartSection({ financialFilter }: Props) {
  await connectToDB();
  initModels();

  const last30Days = startOfDay(subDays(new Date(), 30));
  const todayEnd = endOfDay(new Date());

  // Aggregation: unwind items + group by service name in one pipeline
  const data: { name: string; revenue: number }[] = await Invoice.aggregate([
    { $match: { date: { $gte: last30Days, $lte: todayEnd }, status: 'paid', ...financialFilter } },
    { $unwind: '$items' },
    { $match: { 'items.itemModel': 'Service' } },
    { $group: { _id: '$items.name', revenue: { $sum: '$items.total' } } },
    { $sort: { revenue: -1 } },
    { $limit: 6 },
    { $project: { _id: 0, name: '$_id', revenue: 1 } },
  ]);

  return <ServiceChart data={data} />;
}
