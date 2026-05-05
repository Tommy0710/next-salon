import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { getInvoicePrintData } from "@/lib/invoice-print";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const permissionError = await checkPermission(request, "invoices", "view");
    if (permissionError) return permissionError;

    const { id } = await params;

    try {
        const { invoice, settings, deposits } = await getInvoicePrintData(id);

        if (!invoice) {
            return NextResponse.json(
                { success: false, error: "Invoice not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, invoice, settings, deposits },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
