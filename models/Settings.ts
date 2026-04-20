import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    storeName: {
        type: String,
        required: [true, 'Store name is required'],
        default: 'PosNext'
    },
    address: {
        type: String,
        default: ''
    },
    bookingRules: {
        workingDays: {
            type: [String],
            default: ['1', '2', '3', '4', '5', '6', '0'] // Mặc định làm việc full tuần (0 là CN)
        },
        shift1: {
            start: { type: String, default: "08:00" },
            end: { type: String, default: "12:00" }
        },
        shift2: {
            start: { type: String, default: "13:00" },
            end: { type: String, default: "17:00" }
        },
        clientsPerSession: {
            type: Number,
            default: 1,
            min: 1,
            max: 1000
        },
        avgSessionDuration: {
            type: Number,
            default: 60,
            min: 1,
            max: 240
        }
    },
    phone: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: ''
    },
    taxId: {
        type: String,
        default: ''
    },
    currency: {
        type: String,
        default: 'USD'
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    taxRate: {
        type: Number,
        default: 0
    },
    logoUrl: {
        type: String,
        default: ''
    },
    businessHours: {
        type: String,
        default: 'Mon-Fri: 9:00 AM - 6:00 PM'
    },
    receiptFooter: {
        type: String,
        default: 'Thank you for your business!'
    },
    termsAndConditions: {
        type: String,
        default: ''
    },

    // SMS Settings (Twilio)
    smsEnabled: {
        type: Boolean,
        default: false
    },
    twilioAccountSid: {
        type: String,
        default: ''
    },
    twilioAuthToken: {
        type: String,
        default: ''
    },
    twilioPhoneNumber: {
        type: String,
        default: ''
    },
    // Email Settings (SMTP)
    emailEnabled: {
        type: Boolean,
        default: false
    },
    smtpHost: {
        type: String,
        default: ''
    },
    smtpPort: {
        type: Number,
        default: 587
    },
    smtpSecure: {
        type: Boolean,
        default: false
    },
    smtpUser: {
        type: String,
        default: ''
    },
    smtpPassword: {
        type: String,
        default: ''
    },
    smtpFrom: {
        type: String,
        default: ''
    },
    // Reminder Settings
    reminderHoursBefore: {
        type: Number,
        default: 24,
        max: 72
    },
    reminderMethods: {
        type: [String],
        default: ['email']
    },
    // AI Settings
    aiEnabled: {
        type: Boolean,
        default: false
    },
    openaiApiKey: {
        type: String,
        default: ''
    },
    openaiModel: {
        type: String,
        default: 'gpt-4o'
    },
    qrCodes: [{
        qrId: String,
        name: String,
        bankName: String,
        accountNumber: String,
        image: String
    }],
    // --- THÊM PHẦN NÀY: Zalo ZNS Settings ---
    zaloEnabled: {
        type: Boolean,
        default: false
    },
    zaloAppId: {
        type: String,
        default: ''
    },
    zaloSecretKey: {
        type: String,
        default: ''
    },
    zaloAccessToken: {
        type: String,
        default: ''
    },
    zaloRefreshToken: {
        type: String,
        default: ''
    },
    zaloTokenExpiresAt: {
        type: Date
    },
    zaloTemplates: {
        type: [{
            eventType: String, // Ví dụ: 'checkout', 'reminder'
            name: String,      // Tên bạn tự đặt: "Tin nhắn thanh toán"
            templateId: String // Mã ID từ Zalo
        }],
        default: []
    },
}, {
    timestamps: true
});

// Settings should be a singleton, but we'll handle that in the API logic
// by always fetching/updating the first document
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

export default Settings;
