
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { connectToDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import { initModels } from "@/lib/initModels";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest) {
    try {
        await connectToDB();

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'create');
        if (permissionError) return permissionError;

        initModels();
        const body = await request.json();

        // Generate Invoice Number: Find the latest invoice and increment its number
        const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
        let nextNum = 1;

        if (lastInvoice && lastInvoice.invoiceNumber) {
            const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || "0");
            if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
            }
        }

        const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, '0')}`;

        const invoice = await Invoice.create({
            ...body,
            paymentQrId: body.paymentQrId,
            invoiceNumber
        }) as any;

        await logActivity({
            req: request,
            action: 'create',
            resource: 'invoice',
            resourceId: invoice._id as string,
            details: `Created invoice ${invoiceNumber} for amount $${invoice.totalAmount}`
        });

        return NextResponse.json({ success: true, data: invoice });
    } catch (error: any) {
        console.error("INVOICE_CREATE_ERROR:", error);
        if (error.name === 'ValidationError') {
            return NextResponse.json({
                success: false,
                error: "Validation failed: " + Object.values(error.errors).map((e: any) => e.message).join(', ')
            }, { status: 400 });
        }
        if (error.code === 11000) {
            return NextResponse.json({ success: false, error: "Duplicate invoice number. Please try again." }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "Failed to create invoice" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        await connectToDB();

        // Security Check
        const permissionError = await checkPermission(request, 'invoices', 'view');
        if (permissionError) return permissionError;

        initModels();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "all";
        const source = searchParams.get('source');

        const skip = (page - 1) * limit;

        const query: any = {};

        // Scope Check (Own vs All) - Optional refinement
        // const scope = await getViewScope('invoices');
        // if (scope === 'own') query.staff = session.user.id; 

        if (status !== "all") {
            query.status = status;
        }
        // lọc Source
        if (source === 'appointment') {
            query.appointment = { $exists: true, $ne: null }; // Chỉ lấy đơn có link với lịch hẹn
        } else if (source === 'pos') {
            query.appointment = { $exists: false }; // Hoặc { $eq: null } tùy vào DB của bạn (Chỉ lấy đơn tạo thẳng từ POS)
        }
        if (search) {
            // Search in invoiceNumber
            const searchQueries: any[] = [
                { invoiceNumber: { $regex: search, $options: "i" } }
            ];

            // Or search by customer name if we can find customer IDs
            const customers = await Customer.find({ name: { $regex: search, $options: "i" } }).select('_id');
            if (customers.length > 0) {
                searchQueries.push({ customer: { $in: customers.map(c => c._id) } });
            }

            query.$or = searchQueries;
        }

        const total = await Invoice.countDocuments(query);
        const invoices = await Invoice.find(query)
            .populate('customer', 'name phone')
            .populate('staff', 'name')
            .populate('staffAssignments.staff', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: invoices,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("API Error Invoices GET:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
    }
}
