import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';
import { checkPermission } from '@/lib/rbac';
import { auth } from '@/auth';
import { logActivity } from '@/lib/logger';

const MAX_ROWS = 1000;

// ──────────────────────────────────────────────
// Minimal CSV parser (handles quoted fields)
// ──────────────────────────────────────────────
function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    // Normalize line endings
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < lines.length) {
        const ch = lines[i];

        if (inQuotes) {
            if (ch === '"') {
                // Escaped quote?
                if (lines[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field.trim());
                field = '';
            } else if (ch === '\n') {
                row.push(field.trim());
                field = '';
                if (row.some((c) => c !== '')) rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
        i++;
    }

    // Last field / row
    if (field.trim() || row.length > 0) {
        row.push(field.trim());
        if (row.some((c) => c !== '')) rows.push(row);
    }

    return rows;
}

// POST /api/customers/import
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const permissionError = await checkPermission(request, 'customers', 'create');
        if (permissionError) return permissionError;

        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json(
                { success: false, error: 'Request must be multipart/form-data' },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file uploaded' },
                { status: 400 }
            );
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            return NextResponse.json(
                { success: false, error: 'Only CSV files are supported' },
                { status: 400 }
            );
        }

        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length < 2) {
            return NextResponse.json(
                { success: false, error: 'CSV file is empty or has no data rows' },
                { status: 400 }
            );
        }

        // Parse header → column index map (case-insensitive)
        const headerRow = rows[0].map((h) => h.toLowerCase().trim());
        const col = (name: string) => headerRow.indexOf(name);

        const nameIdx = col('name');
        if (nameIdx === -1) {
            return NextResponse.json(
                { success: false, error: 'CSV must have a "name" column' },
                { status: 400 }
            );
        }

        const dataRows = rows.slice(1);
        if (dataRows.length > MAX_ROWS) {
            return NextResponse.json(
                { success: false, error: `Too many rows. Maximum allowed: ${MAX_ROWS}` },
                { status: 400 }
            );
        }

        const session: any = await auth();
        const createdById = session?.user?.id;

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [] as { row: number; reason: string }[],
        };

        for (let i = 0; i < dataRows.length; i++) {
            const rowNum = i + 2; // 1-indexed, account for header
            const cells = dataRows[i];

            const getValue = (idx: number) =>
                idx !== -1 && cells[idx] ? cells[idx].trim() : '';

            const name = getValue(nameIdx);
            if (!name) {
                results.errors.push({ row: rowNum, reason: '"name" is required' });
                results.skipped++;
                continue;
            }

            const email = getValue(col('email'));
            const phone = getValue(col('phone'));
            const address = getValue(col('address'));
            const notes = getValue(col('notes'));
            const statusRaw = getValue(col('status')).toLowerCase();
            const status =
                statusRaw === '0' || statusRaw === 'inactive' ? 0 : 1;

            try {
                // Upsert logic: match by phone OR email if provided
                let filter: any = null;
                if (phone) filter = { phone };
                else if (email) filter = { email };

                if (filter) {
                    const existing = await Customer.findOne(filter);
                    if (existing) {
                        await Customer.findByIdAndUpdate(existing._id, {
                            name,
                            ...(email && { email }),
                            ...(phone && { phone }),
                            ...(address && { address }),
                            ...(notes && { notes }),
                            status,
                        });
                        results.updated++;
                        continue;
                    }
                }

                // Create new
                await Customer.create({
                    name,
                    email: email || undefined,
                    phone: phone || undefined,
                    address: address || undefined,
                    notes: notes || undefined,
                    status,
                    createdBy: createdById,
                });
                results.imported++;
            } catch (err: any) {
                results.errors.push({ row: rowNum, reason: err.message });
                results.skipped++;
            }
        }

        await logActivity({
            req: request,
            action: 'create',
            resource: 'customer',
            resourceId: 'bulk-import',
            details: `Imported customers: ${results.imported} new, ${results.updated} updated, ${results.skipped} skipped`,
        });

        return NextResponse.json({
            success: true,
            data: {
                total: dataRows.length,
                imported: results.imported,
                updated: results.updated,
                skipped: results.skipped,
                errors: results.errors,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET /api/customers/import — trả về CSV template
export async function GET() {
    const template = [
        'name,email,phone,address,notes,status',
        'Nguyễn Văn A,a@example.com,0901234567,Hà Nội,,1',
        'Trần Thị B,b@example.com,0912345678,TP.HCM,Khách VIP,1',
    ].join('\n');

    return new NextResponse(template, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="customers_template.csv"',
        },
    });
}
