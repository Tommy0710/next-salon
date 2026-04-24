import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ProductCategory from "@/models/ProductCategory";
import { logActivity } from "@/lib/logger";

export async function GET() {
    try {
        await connectToDB();
        const categories = await ProductCategory.find({ status: "active" }).sort({ name: 1 });
        return NextResponse.json({ success: true, data: categories });
    } catch {
        return NextResponse.json({ success: false, error: "Failed to fetch product categories" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectToDB();
        const body = await request.json();
        const category: any = await ProductCategory.create(body);

        await logActivity({
            req: request,
            action: "create",
            resource: "product-category",
            resourceId: category._id?.toString(),
            details: `Created product category ${category.name}`,
        });

        return NextResponse.json({ success: true, data: category });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || "Failed to create category" }, { status: 500 });
    }
}
