import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Service from "@/models/Service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();
        const service = await Service.findByIdAndUpdate(id, body, { new: true });

        if (!service) {
            return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error("Error updating service:", error);
        return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const service = await Service.findByIdAndUpdate(id, { status: 0 }, { new: true });

        if (!service) {
            return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error("Error deleting service:", error);
        return NextResponse.json({ success: false, error: "Failed to delete service" }, { status: 500 });
    }
}
