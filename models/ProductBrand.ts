
import mongoose, { Schema, Document } from 'mongoose';

export interface IProductBrand extends Document {
    name: string;
    description?: string;
    status: 'active' | 'inactive';
}

const productBrandSchema = new Schema<IProductBrand>(
    {
        name: { type: String, required: true, trim: true, unique: true },
        description: { type: String, trim: true },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    { timestamps: true }
);

productBrandSchema.index({ status: 1, name: 1 });

export default mongoose.models.ProductBrand || mongoose.model<IProductBrand>('ProductBrand', productBrandSchema);
