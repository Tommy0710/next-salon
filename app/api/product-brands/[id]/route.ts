import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ProductBrand from "@/models/ProductBrand";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();
        const brand = await ProductBrand.findByIdAndUpdate(id, body, { new: true });
        if (!brand) return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: brand });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || "Failed to update brand" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const brand = await ProductBrand.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
        if (!brand) return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: brand });
    } catch {
        return NextResponse.json({ success: false, error: "Failed to delete brand" }, { status: 500 });
    }
}
