import { connectToDB } from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Settings from "@/models/Settings";
import Deposit from "@/models/Deposit";
import { initModels } from "@/lib/initModels";

export interface PrintInvoiceData {
    invoice: any;
    settings: any;
    deposits: any[];
}

export async function getInvoicePrintData(id: string): Promise<PrintInvoiceData> {
    await connectToDB();
    initModels();

    const [invoice, settings, deposits] = await Promise.all([
        Invoice.findById(id)
            .populate("customer", "name phone email")
            .populate("staffAssignments.staff", "name")
            .lean(),
        Settings.findOne()
            .select("storeName logoUrl address phone currency qrCodes")
            .lean(),
        Deposit.find({ invoice: id })
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    return {
        invoice: invoice ?? null,
        settings: settings ?? {},
        deposits: deposits ?? [],
    };
}
