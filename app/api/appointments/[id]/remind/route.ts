import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'appointments', 'edit');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;

        const appointment = await Appointment.findByIdAndUpdate(
            id,
            {
                $inc: { reminderCount: 1 },
                $set: { reminderSent: true, reminderSentAt: new Date() },
            },
            { new: true }
        ).populate('customer').populate('staff');

        if (!appointment) {
            return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        return handleApiError('REMIND_APPOINTMENT', error);
    }
}
