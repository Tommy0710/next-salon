
import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
    invoiceNumber: string;
    customer: mongoose.Types.ObjectId;
    appointment?: mongoose.Types.ObjectId;
    bookingCode?: string;
    items: {
        item: mongoose.Types.ObjectId; // Service or Product ID
        itemModel: 'Service' | 'Product';
        name: string;
        price: number;
        quantity: number;
        discount: number; // Amount
        total: number;
    }[];
    subtotal: number;
    tax: number;
    discount: number; // Global discount
    totalAmount: number;
    amountPaid: number;
    paymentMethod: string; // Cash, Card, etc.
    paymentQrId?: string;
    qrCodeImage?: string;
    bankDetails?: string;
    status: 'paid' | 'pending' | 'partially_paid' | 'cancelled';
    staff?: mongoose.Types.ObjectId;
    staffAssignments: {
        staff: mongoose.Types.ObjectId;
        percentage: number;
        commission: number;
    }[];
    commission: number;
    notes?: string;
    date: Date;
}

const invoiceSchema = new Schema<IInvoice>(
    {
        invoiceNumber: { type: String, required: true, unique: true },
        customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
        appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
        bookingCode: { type: String },
        items: [
            {
                item: { type: Schema.Types.ObjectId, required: true, refPath: 'items.itemModel' },
                itemModel: { type: String, required: true, enum: ['Service', 'Product'] },
                name: String,
                price: Number,
                quantity: { type: Number, default: 1 },
                discount: { type: Number, default: 0 },
                total: Number,
            },
        ],
        subtotal: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
        amountPaid: { type: Number, default: 0 },
        paymentMethod: { type: String, default: 'Cash' },
        paymentQrId: String,
        qrCodeImage: String,
        bankDetails: String,
        status: {
            type: String,
            enum: ['paid', 'pending', 'partially_paid', 'cancelled'],
            default: 'paid',
        },
        staff: { type: Schema.Types.ObjectId, ref: 'Staff' },
        staffAssignments: [
            {
                staff: { type: Schema.Types.ObjectId, ref: 'Staff' },
                percentage: { type: Number, default: 0 },
                commission: { type: Number, default: 0 },
            },
        ],
        commission: { type: Number, default: 0 },
        notes: String,
        date: { type: Date, default: Date.now },

    },
    { timestamps: true }
);

if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Invoice;
}

// ── Production Indexes ─────────────────────────────────────────────────────
// Sort mặc định tất cả list queries
invoiceSchema.index({ createdAt: -1 });
// Filter by status + sort
invoiceSchema.index({ status: 1, createdAt: -1 });
// Customer invoice history
invoiceSchema.index({ customer: 1, createdAt: -1 });
// Lọc source: appointment vs POS
invoiceSchema.index({ appointment: 1 });
// Search by invoice number (unique lookup)
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });

export default mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', invoiceSchema);
