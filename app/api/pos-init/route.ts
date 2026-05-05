import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { initModels } from "@/lib/initModels";
import Service from "@/models/Service";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Staff from "@/models/Staff";

export async function GET(_request: NextRequest) {
    try {
        await connectToDB();
        initModels();

        const [services, products, customers, staff] = await Promise.all([
            Service.find({ status: 1 })
                .select("name price duration commissionType commissionValue")
                .sort({ name: 1 })
                .limit(5000)
                .lean(),
            Product.find({ status: "active" })
                .select("name price image productType stock commissionType commissionValue")
                .sort({ name: 1 })
                .limit(5000)
                .lean(),
            Customer.find({})
                .select("name phone walletBalance")
                .sort({ createdAt: -1 })
                .limit(5000)
                .lean(),
            Staff.find({ isActive: true })
                .select("name commissionRate")
                .sort({ name: 1 })
                .limit(500)
                .lean(),
        ]);

        return NextResponse.json(
            {
                success: true,
                data: {
                    services: services.map((s) => ({ ...s, type: "Service" })),
                    products: products.map((p) => ({ ...p, type: "Product" })),
                    customers,
                    staff,
                },
            },
            { headers: { "Cache-Control": "private, max-age=30" } }
        );
    } catch (error) {
        console.error("[pos-init]", error);
        return NextResponse.json(
            { success: false, error: "Failed to load POS data" },
            { status: 500 }
        );
    }
}
