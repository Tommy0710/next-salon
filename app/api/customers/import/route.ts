import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';
import { checkPermission } from '@/lib/rbac';
import { auth } from '@/auth';
import { logActivity } from '@/lib/logger';

const MAX_ROWS = 5000;

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

            // Validate phone: skip if provided but has fewer than 7 digits
            if (phone) {
                const digitsOnly = phone.replace(/\D/g, '');
                if (digitsOnly.length < 7) {
                    results.errors.push({ row: rowNum, reason: `Phone "${phone}" is too short (min 7 digits)` });
                    results.skipped++;
                    continue;
                }
            }

            // gender: accept male/female/other (default 'other')
            const genderRaw = getValue(col('gender')).toLowerCase();
            const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : 'other';

            // dateOfBirth: accept ISO date string (YYYY-MM-DD); aliases: dateofbirth, date_of_birth, birthday
            const dobIdx = col('dateofbirth') !== -1 ? col('dateofbirth')
                : col('date_of_birth') !== -1 ? col('date_of_birth')
                    : col('birthday');
            const dobRaw = getValue(dobIdx);
            const dateOfBirth = dobRaw && !isNaN(Date.parse(dobRaw)) ? new Date(dobRaw) : undefined;

            // visitCount: non-negative integer; aliases: visitcount, visit_count
            const vcIdx = col('visitcount') !== -1 ? col('visitcount') : col('visit_count');
            const visitCountRaw = getValue(vcIdx);
            const visitCount = visitCountRaw !== '' && !isNaN(Number(visitCountRaw))
                ? Math.max(0, Math.floor(Number(visitCountRaw))) as number
                : undefined;

            // totalSpent → totalPurchases: non-negative number; aliases: totalspent, total_spent, totalpurchases, total_purchases
            const tsIdx = col('totalspent') !== -1 ? col('totalspent')
                : col('total_spent') !== -1 ? col('total_spent')
                    : col('totalpurchases') !== -1 ? col('totalpurchases')
                        : col('total_purchases');
            const totalSpentRaw = getValue(tsIdx);
            const totalPurchases = totalSpentRaw !== '' && !isNaN(Number(totalSpentRaw))
                ? Math.max(0, Number(totalSpentRaw)) as number
                : undefined;

            const statusRaw = getValue(col('status')).toLowerCase();
            const status = statusRaw === '0' || statusRaw === 'inactive' ? 0 : 1;

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
                            gender,
                            ...(dateOfBirth !== undefined && { dateOfBirth }),
                            ...(visitCount !== undefined && { visitCount: Number(visitCount) }),
                            ...(totalPurchases !== undefined && { totalPurchases: Number(totalPurchases) }),
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
                    gender,
                    ...(dateOfBirth !== undefined && { dateOfBirth }),
                    ...(visitCount !== undefined && { visitCount: Number(visitCount) }),
                    ...(totalPurchases !== undefined && { totalPurchases: Number(totalPurchases) }),
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
        'name,email,phone,address,notes,gender,birthday,visitCount,totalSpent,status',
        'Nguy\u1ec5n V\u0103n A,a@example.com,0901234567,H\u00e0 N\u1ed9i,,male,1990-01-15,5,1500000,1',
        'Tr\u1ea7n Th\u1ecb B,b@example.com,0912345678,TP.HCM,Kh\u00e1ch VIP,female,1985-06-20,12,3200000,1',
    ].join('\n');

    return new NextResponse(template, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="customers_template.csv"',
        },
    });
}
