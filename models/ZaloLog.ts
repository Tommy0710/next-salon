import mongoose, { Schema, Document, models } from 'mongoose';

export interface IZaloLog extends Document {
    phone: string;
    templateId: string;
    templateName?: string;
    eventType?: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    trackingId?: string;
    sentAt: Date;
    responseData?: any;
}

const zaloLogSchema = new Schema<IZaloLog>(
    {
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        templateId: {
            type: String,
            required: true,
        },
        templateName: {
            type: String,
            trim: true,
        },
        eventType: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['success', 'failed'],
            required: true,
        },
        errorMessage: {
            type: String,
        },
        trackingId: {
            type: String,
        },
        sentAt: {
            type: Date,
            default: Date.now,
        },
        responseData: {
            type: Schema.Types.Mixed,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Index for efficient queries
zaloLogSchema.index({ sentAt: -1 });
zaloLogSchema.index({ phone: 1 });
zaloLogSchema.index({ status: 1 });

const ZaloLog = models.ZaloLog || mongoose.model<IZaloLog>('ZaloLog', zaloLogSchema);

export default ZaloLog;