import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/models/Customer';

import { checkPermission, getViewScope } from '@/lib/rbac';
import { auth } from '@/auth';
import { validateAndSanitize, validationErrorResponse } from '@/lib/validation';
import { logActivity } from '@/lib/logger';

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'customers', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        // Apply Scope
        const scope = await getViewScope('customers');
        let query: any = {};

        if (scope === 'own') {
            const session: any = await auth();
            if (session?.user?.id) {
                query.createdBy = session.user.id;
            }
        }
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const customers = await Customer.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Customer.countDocuments(query);

        return NextResponse.json({
            success: true,
            data: customers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'customers', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Validate and sanitize input
        const validation = validateAndSanitize(body, {
            required: ['name'],
            email: ['email'],
            phone: ['phone'],
            maxLength: [
                { field: 'name', length: 100 },
                { field: 'email', length: 100 },
                { field: 'phone', length: 20 },
                { field: 'address', length: 255 }
            ]
        });

        if (!validation.isValid) {
            return validationErrorResponse(validation.errors);
        }

        const session: any = await auth();
        const customer = await Customer.create({
            ...validation.sanitizedData,
            createdBy: session?.user?.id
        }) as any;

        await logActivity({
            req: request,
            action: 'create',
            resource: 'customer',
            resourceId: customer._id as string,
            details: `Created customer: ${customer.name}`
        });

        return NextResponse.json({ success: true, data: customer }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }
}
