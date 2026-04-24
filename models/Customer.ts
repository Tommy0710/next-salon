import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    walletBalance?: number;
    totalPurchases: number;
    loyaltyPoints: number;
    createdBy?: string;
    gender?: 'male' | 'female' | 'other';
    visitCount?: number;
    dateOfBirth?: Date;
    status: 1 | 0;
}

const customerSchema = new Schema<ICustomer>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        address: { type: String, trim: true },
        notes: { type: String, trim: true },
        walletBalance: { type: Number, default: 0, min: 0 },
        totalPurchases: { type: Number, default: 0, min: 0 },
        loyaltyPoints: { type: Number, default: 0, min: 0 },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            default: 'other',
        },
        visitCount: { type: Number, default: 0, min: 0 },
        dateOfBirth: { type: Date },
        status: {
            type: Number,
            enum: [1, 0],
            default: 1,
        },
    },
    { timestamps: true }
);

// Index for faster searches (text search)
customerSchema.index({ name: 'text', email: 'text', phone: 'text' });
// Phone lookup (unique customers)
customerSchema.index({ phone: 1 }, { sparse: true });
// Status filter + sort
customerSchema.index({ status: 1, createdAt: -1 });
// Default sort
customerSchema.index({ createdAt: -1 });

export default mongoose.models.Customer || mongoose.model<ICustomer>('Customer', customerSchema);

