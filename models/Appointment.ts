
import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
    customer: mongoose.Types.ObjectId;
    staff?: mongoose.Types.ObjectId;
    services: {
        service: mongoose.Types.ObjectId;
        name: string;
        price: number;
        duration: number;
    }[];
    date: Date;
    startTime: string; // "14:00"
    endTime: string; // "15:00"
    totalDuration: number;
    subtotal: number;
    tax: number;
    totalAmount: number;
    discount: {
        type: 'percentage' | 'fixed';
        value: number;
    };
    commission: number;
    tips: number;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
    notes?: string;
    source?: string;
    bookingCode?: string;
    reminderSent?: boolean;
    reminderSentAt?: Date;
    reminderCount?: number;
    lastReminderAttemptAt?: Date;
}

const appointmentSchema = new Schema<IAppointment>(
    {
        customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: false },
        services: [
            {
                service: { type: Schema.Types.ObjectId, ref: 'Service' },
                name: String,
                price: Number,
                duration: Number,
            },
        ],
        date: { type: Date, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        totalDuration: { type: Number, required: true },
        subtotal: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
        discount: {
            type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
            value: { type: Number, default: 0, min: 0 },
        },
        commission: { type: Number, default: 0 },
        tips: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
            default: 'pending',
        },
        notes: { type: String },
        source: { type: String, default: 'Direct' },
        bookingCode: { type: String },
        reminderSent: { type: Boolean, default: false },
        reminderSentAt: { type: Date },
        reminderCount: { type: Number, default: 0 },
        lastReminderAttemptAt: { type: Date },
    },
    { timestamps: true }
);

// ── Production Indexes ─────────────────────────────────────────────────────
// Calendar queries: date range filter + status
appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ date: 1 });
// Cron reminder query: covers all filter fields in order
appointmentSchema.index({ date: 1, status: 1, reminderSent: 1 });
// Sort mặc định
appointmentSchema.index({ createdAt: -1 });
// Customer appointment history
appointmentSchema.index({ customer: 1, date: -1 });
// Staff schedule view
appointmentSchema.index({ staff: 1, date: -1 });

export default mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', appointmentSchema);
