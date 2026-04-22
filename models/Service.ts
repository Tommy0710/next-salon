
import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
    name: string;
    category: mongoose.Types.ObjectId;
    description?: string;
    duration: number; // in minutes
    price: number;
    gender: 'male' | 'female' | 'unisex';
    image?: string;
    commissionType: 'percentage' | 'fixed';
    commissionValue: number;
    status: 1 | 0;
}

const serviceSchema = new Schema<IService>(
    {
        name: { type: String, required: true, trim: true },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'ServiceCategory',
            required: true,
        },
        description: { type: String, trim: true },
        duration: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        gender: {
            type: String,
            enum: ['male', 'female', 'unisex'],
            default: 'unisex',
        },
        image: { type: String },
        commissionType: {
            type: String,
            enum: ['percentage', 'fixed'],
            default: 'percentage',
        },
        commissionValue: { type: Number, default: 0 },
        status: {
            type: Number,
            enum: [1, 0],
            default: 1,
        },
    },
    { timestamps: true }
);

// ── Production Indexes ─────────────────────────────────────────────────────
serviceSchema.index({ category: 1, name: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ createdAt: -1 });

export default mongoose.models.Service || mongoose.model<IService>('Service', serviceSchema);
