import mongoose, { Schema, Model, models } from 'mongoose';

export interface IRole {
    _id: string;
    name: string;
    description?: string;
    isAdmin: boolean; // Chỉ cần 1 cờ này là đủ
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: [true, 'Role name is required'],
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        isAdmin: {
            type: Boolean,
            default: false, // Mặc định tạo ra sẽ là Staff
        },
        isSystem: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

const Role = (models.Role as Model<IRole>) || mongoose.model<IRole>('Role', RoleSchema);

export default Role;