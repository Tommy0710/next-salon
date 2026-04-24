import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ProductBrand from "@/models/ProductBrand";
import { logActivity } from "@/lib/logger";

export async function GET() {
    try {
        await connectToDB();
        const brands = await ProductBrand.find({ status: "active" }).sort({ name: 1 });
        return NextResponse.json({ success: true, data: brands });
    } catch {
        return NextResponse.json({ success: false, error: "Failed to fetch product brands" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectToDB();
        const body = await request.json();
        const brand: any = await ProductBrand.create(body);

        await logActivity({
            req: request,
            action: "create",
            resource: "product-brand",
            resourceId: brand._id?.toString(),
            details: `Created product brand ${brand.name}`,
        });

        return NextResponse.json({ success: true, data: brand });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || "Failed to create brand" }, { status: 500 });
    }
}
