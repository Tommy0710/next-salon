
import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    category: mongoose.Types.ObjectId;
    brand?: mongoose.Types.ObjectId;
    description?: string;
    price: number; // Retail Price
    costPrice: number;
    stock: number;
    alertQuantity: number;
    sku?: string;
    barcode?: string;
    type: 'retail' | 'internal';
    image?: string;
    supplier?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive';
}

const productSchema = new Schema<IProduct>(
    {
        name: { type: String, required: true, trim: true },
        category: { type: Schema.Types.ObjectId, ref: 'ProductCategory', required: true },
        brand: { type: Schema.Types.ObjectId, ref: 'ProductBrand' },
        description: { type: String, trim: true },
        price: { type: Number, required: true, min: 0 },
        costPrice: { type: Number, required: true, min: 0 },
        stock: { type: Number, default: 0 },
        alertQuantity: { type: Number, default: 5 },
        sku: { type: String, trim: true, unique: true, sparse: true },
        barcode: { type: String, trim: true },
        type: {
            type: String,
            enum: ['retail', 'internal'],
            default: 'retail',
        },
        image: { type: String },
        supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    { timestamps: true }
);

// ── Production Indexes ─────────────────────────────────────────────────────
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });

export default mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);
