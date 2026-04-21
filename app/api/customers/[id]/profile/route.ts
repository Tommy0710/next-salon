import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';
import Invoice from '@/models/Invoice';
import Appointment from '@/models/Appointment';
import { checkPermission } from '@/lib/rbac';

// GET /api/customers/[id]/profile
// Returns full customer profile: info + invoice history + appointment history + stats
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();

        const permissionError = await checkPermission(request, 'customers', 'view');
        if (permissionError) return permissionError;

        const { id } = await params;

        // 1. Base customer info
        const customer = await Customer.findById(id).lean();
        if (!customer) {
            return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
        }

        // 2. Invoice history (last 20)
        const invoices = await Invoice.find({ customer: id })
            .sort({ date: -1 })
            .limit(20)
            .lean();

        // 3. Appointment history (last 20)
        const appointments = await Appointment.find({ customer: id })
            .sort({ date: -1 })
            .limit(20)
            .lean();

        // 4. Aggregate stats
        const allInvoices = await Invoice.find({ customer: id }).lean();

        const totalRevenue = allInvoices
            .filter((inv: any) => inv.status === 'paid' || inv.status === 'partially_paid')
            .reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);

        const totalVisits = allInvoices.filter((inv: any) => inv.status !== 'cancelled').length;

        // 5. Aggregate services used across all invoices
        const serviceMap: Record<string, { name: string; count: number; totalSpent: number }> = {};
        allInvoices.forEach((inv: any) => {
            if (inv.status === 'cancelled') return;
            (inv.items || []).forEach((item: any) => {
                if (item.itemModel === 'Service') {
                    const key = item.name || String(item.item);
                    if (!serviceMap[key]) {
                        serviceMap[key] = { name: item.name || 'Unknown', count: 0, totalSpent: 0 };
                    }
                    serviceMap[key].count += item.quantity || 1;
                    serviceMap[key].totalSpent += item.total || item.price * (item.quantity || 1);
                }
            });
        });
        const topServices = Object.values(serviceMap).sort((a, b) => b.count - a.count);

        // 6. Monthly spending trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentInvoices = allInvoices.filter((inv: any) => {
            return new Date(inv.date) >= sixMonthsAgo && inv.status !== 'cancelled';
        });
        const monthlyMap: Record<string, number> = {};
        recentInvoices.forEach((inv: any) => {
            const d = new Date(inv.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = (monthlyMap[key] || 0) + (inv.totalAmount || 0);
        });
        const monthlySpend = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({ month, amount }));

        return NextResponse.json({
            success: true,
            data: {
                customer,
                invoices,
                appointments,
                stats: {
                    totalRevenue,
                    totalVisits,
                    totalInvoices: allInvoices.length,
                    avgOrderValue: totalVisits > 0 ? totalRevenue / totalVisits : 0,
                    topServices,
                    monthlySpend,
                },
            },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
