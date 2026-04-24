
import mongoose, { Schema, Document } from 'mongoose';

export interface IProductCategory extends Document {
    name: string;
    description?: string;
    status: 'active' | 'inactive';
}

const productCategorySchema = new Schema<IProductCategory>(
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

productCategorySchema.index({ status: 1, name: 1 });

export default mongoose.models.ProductCategory || mongoose.model<IProductCategory>('ProductCategory', productCategorySchema);
