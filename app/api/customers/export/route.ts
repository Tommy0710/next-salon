import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';
import { checkPermission } from '@/lib/rbac';

// Helper: escape a CSV cell value
function escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, newline, or double-quote → wrap in double-quotes and escape inner quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// GET /api/customers/export
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const permissionError = await checkPermission(request, 'customers', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        let query: any = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                ],
            };
        }

        const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();

        // CSV header row
        const headers = [
            'name',
            'email',
            'phone',
            'address',
            'notes',
            'status',
            'totalPurchases',
            'loyaltyPoints',
            'createdAt',
        ];

        const rows = customers.map((c: any) => [
            escapeCSV(c.name),
            escapeCSV(c.email),
            escapeCSV(c.phone),
            escapeCSV(c.address),
            escapeCSV(c.notes),
            escapeCSV(c.status),
            escapeCSV(c.totalPurchases),
            escapeCSV(c.loyaltyPoints),
            escapeCSV(c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : ''),
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((r) => r.join(',')),
        ].join('\n');

        const date = new Date().toISOString().split('T')[0];
        const filename = `customers_${date}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
