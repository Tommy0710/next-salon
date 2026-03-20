import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Payroll from "@/models/Payroll";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const payroll = await Payroll.findById(id).populate("staff", "name email phone");

        if (!payroll) {
            return NextResponse.json({ success: false, error: "Payroll not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: payroll });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;
        const body = await request.json();

        const payroll = await Payroll.findByIdAndUpdate(id, body, { new: true }).populate("staff", "name email phone");

        if (!payroll) {
            return NextResponse.json({ success: false, error: "Payroll not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: payroll });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectToDB();
        const { id } = await params;

        const payroll = await Payroll.findById(id);
        if (!payroll) {
            return NextResponse.json({ success: false, error: "Payroll not found" }, { status: 404 });
        }

        await Payroll.findByIdAndDelete(id);
        return NextResponse.json({ success: true, message: "Payroll deleted" });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
