"use client";

import { useState, useEffect } from "react";
import { Save, Store, Mail, Phone, MapPin, DollarSign, Percent, Image as ImageIcon, Globe, FileText, Clock, CreditCard, MessageSquare, Send, Bell, Sparkles, QrCode, Trash2, ChevronDown } from "lucide-react";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { getAllCurrencies } from "@/lib/currency";
import { getAllTimezones } from "@/lib/timezones";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";

interface Settings {
    storeName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    taxId: string;
    currency: string;
    timezone: string;
    taxRate: number;
    logoUrl: string;
    businessHours: string;
    receiptFooter: string;
    termsAndConditions: string;

    // SMS Settings
    smsEnabled: boolean;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
    // Email Settings
    emailEnabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    // Reminder Settings
    reminderDaysBefore: number;
    reminderMethods: string[];
    // AI Settings
    aiEnabled: boolean;
    openaiApiKey: string;
    openaiModel: string;
    qrCodes: { qrId: string; name: string; bankName: string; accountNumber: string; image: string }[];
    zaloEnabled: boolean;
    zaloAppId: string;
    zaloSecretKey: string;
    zaloTemplates: Array<{ eventType: string; name: string; templateId: string }>;
    zaloAccessToken: string;
    zaloRefreshToken: string;
}

const defaultZaloTemplates = [
    { eventType: 'checkout', name: 'Mẫu Cảm ơn & Hóa đơn', templateId: '' },
    { eventType: 'appointment_reminder', name: 'Mẫu Nhắc lịch hẹn', templateId: '' },
    { eventType: 'appointment_confirmed', name: 'Mẫu Cảm ơn và confirm', templateId: '' },
    { eventType: 'appointment_cancelled', name: 'Mẫu Hủy lịch hẹn', templateId: '' },
    { eventType: 'birthday', name: 'Mẫu Sinh nhật', templateId: '' },
];

export default function SettingsPage() {
    const { refreshSettings } = useSettings();
    const [settings, setSettings] = useState<Settings>({
        storeName: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        taxId: "",
        currency: "USD",
        timezone: "UTC",
        taxRate: 0,
        logoUrl: "",
        businessHours: "Mon-Fri: 9:00 AM - 6:00 PM",
        receiptFooter: "Thank you for your business!",
        termsAndConditions: "",
        // SMS Settings
        smsEnabled: false,
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioPhoneNumber: "",
        // Email Settings
        emailEnabled: false,
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "",
        smtpPassword: "",
        smtpFrom: "",
        // Reminder Settings
        reminderDaysBefore: 1,
        reminderMethods: ["sms", "email"],
        // AI Settings
        aiEnabled: false,
        openaiApiKey: "",
        openaiModel: "gpt-4o",
        qrCodes: [],
        // 👇 THÊM DÒNG NÀY VÀO:
        zaloEnabled: false,
        zaloAppId: '',
        zaloSecretKey: '',
        zaloTemplates: defaultZaloTemplates,
        zaloAccessToken: '',
        zaloRefreshToken: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [newQr, setNewQr] = useState({ name: "", bankName: "", accountNumber: "", image: "" });
    const [openTabs, setOpenTabs] = useState({
        general: true,
        contact: false,
        business: false,
        financial: false,
        receipt: false,
        reminder: false,
        ai: false,
        zalo: false,
        sms: false,
        email: false,
        qrcode: false,
    });
    const toggleTab = (tabName: keyof typeof openTabs) => {
        setOpenTabs(prev => ({ ...prev, [tabName]: !prev[tabName] }));
    };

    const currencies = getAllCurrencies();
    const timezones = getAllTimezones();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings", { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                // Merge fetched data with defaults to ensure all fields exist
                setSettings({
                    storeName: data.data.storeName || "",
                    address: data.data.address || "",
                    phone: data.data.phone || "",
                    email: data.data.email || "",
                    website: data.data.website || "",
                    taxId: data.data.taxId || "",
                    currency: data.data.currency || "USD",
                    timezone: data.data.timezone || "UTC",
                    taxRate: data.data.taxRate || 0,
                    logoUrl: data.data.logoUrl || "",
                    businessHours: data.data.businessHours || "Mon-Fri: 9:00 AM - 6:00 PM",
                    receiptFooter: data.data.receiptFooter || "Thank you for your business!",
                    termsAndConditions: data.data.termsAndConditions || "",

                    // SMS Settings
                    smsEnabled: data.data.smsEnabled || false,
                    twilioAccountSid: data.data.twilioAccountSid || "",
                    twilioAuthToken: data.data.twilioAuthToken || "",
                    twilioPhoneNumber: data.data.twilioPhoneNumber || "",
                    // Email Settings
                    emailEnabled: data.data.emailEnabled || false,
                    smtpHost: data.data.smtpHost || "",
                    smtpPort: data.data.smtpPort || 587,
                    smtpSecure: data.data.smtpSecure || false,
                    smtpUser: data.data.smtpUser || "",
                    smtpPassword: data.data.smtpPassword || "",
                    smtpFrom: data.data.smtpFrom || "",
                    // Reminder Settings
                    reminderDaysBefore: data.data.reminderDaysBefore || 1,
                    reminderMethods: (() => {
                        // Backward compatibility: convert old reminderMethod to array
                        if (data.data.reminderMethod) {
                            if (data.data.reminderMethod === 'both') return ['sms', 'email'];
                            if (data.data.reminderMethod === 'sms') return ['sms'];
                            if (data.data.reminderMethod === 'email') return ['email'];
                        }
                        return data.data.reminderMethods || ['sms', 'email'];
                    })(),
                    // AI Settings
                    aiEnabled: data.data.aiEnabled || false,
                    openaiApiKey: data.data.openaiApiKey || "",
                    openaiModel: data.data.openaiModel || "gpt-4o",
                    qrCodes: data.data.qrCodes || [],
                    // Zalo Settings
                    zaloEnabled: data.data.zaloEnabled || false,
                    zaloAppId: data.data.zaloAppId || '',
                    zaloSecretKey: data.data.zaloSecretKey || '',
                    zaloTemplates: (() => {
                        const storedTemplates = Array.isArray(data.data.zaloTemplates) ? data.data.zaloTemplates : [];
                        const mergedTemplates = defaultZaloTemplates.map(defaultTemplate => ({
                            ...defaultTemplate,
                            templateId: storedTemplates.find((t: any) => t.eventType === defaultTemplate.eventType)?.templateId || ''
                        }));
                        const extraTemplates = storedTemplates.filter((t: any) => !defaultZaloTemplates.some((d) => d.eventType === t.eventType));
                        return [...mergedTemplates, ...extraTemplates];
                    })(),
                    zaloAccessToken: data.data.zaloAccessToken || '',
                    zaloRefreshToken: data.data.zaloRefreshToken || '',
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            setMessage({ type: "error", text: "Failed to load settings" });
        } finally {
            setLoading(false);
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setMessage({ type: "error", text: data.error || "Failed to save settings" });
                return;
            }

            setSettings(data.data);
            // await refreshSettings(); // Không cần refresh vì đã setSettings với data từ save
            setMessage({ type: "success", text: "Settings saved successfully!" });
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage({ type: "error", text: "Failed to save settings" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-900 border-t-transparent"></div>
            </div>
        );
    }
    const handleTemplateChange = (index: number, newId: string) => {
        if (!settings.zaloTemplates || !Array.isArray(settings.zaloTemplates)) return;

        const updatedTemplates = [...settings.zaloTemplates];
        if (updatedTemplates[index]) {
            updatedTemplates[index].templateId = newId;
            setSettings({ ...settings, zaloTemplates: updatedTemplates });
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Cài đặt cửa hàng</h1>
                <p className="text-gray-500">Quản lý chi tiết và cấu hình cửa hàng của bạn</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('general')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Store className="w-5 h-5 text-primary-900" />
                            Thông tin chung
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.general ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.general && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="grid grid-cols-1 gap-6">
                                <FormInput
                                    label="Tên cửa hàng"
                                    value={settings.storeName}
                                    onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                                    required
                                    placeholder="e.g. PosNext"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Logo cửa hàng
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setSettings({ ...settings, logoUrl: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                </div>
                                {settings.logoUrl && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Xem trước logo</label>
                                        <div className="flex items-center gap-4">
                                            <img src={settings.logoUrl} alt="Store Logo" className="h-20 object-contain border rounded p-2" />
                                            <button
                                                type="button"
                                                onClick={() => setSettings({ ...settings, logoUrl: "" })}
                                                className="text-sm text-red-600 hover:text-red-700"
                                            >
                                                Xóa logo
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contact Details */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('contact')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Phone className="w-5 h-5 text-primary-900" />
                            Chi tiết liên hệ
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.contact ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.contact && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput
                                    label="Số điện thoại"
                                    value={settings.phone}
                                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                    placeholder="+1 234 567 890"
                                />
                                <FormInput
                                    label="Địa chỉ email"
                                    value={settings.email}
                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                    type="email"
                                    placeholder="contact@store.com"
                                />
                                <FormInput
                                    label="Trang web"
                                    value={settings.website}
                                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                                    placeholder="https://www.yourstore.com"
                                />
                                <FormInput
                                    label="Giờ làm việc"
                                    value={settings.businessHours}
                                    onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                                    placeholder="Mon-Fri: 9:00 AM - 6:00 PM"
                                />
                                <div className="md:col-span-2">
                                    <FormInput
                                        label="Địa chỉ"
                                        value={settings.address}
                                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                        placeholder="123 Main St, City, Country"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Business Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('business')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary-900" />
                            Thông tin kinh doanh
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.business ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.business && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="grid grid-cols-1 gap-6">
                                <FormInput
                                    label="Mã số thuế / Số đăng ký"
                                    value={settings.taxId}
                                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                                    placeholder="e.g. 123-456-789"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Financial Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('financial')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-primary-900" />
                            Cài đặt tài chính
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.financial ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.financial && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormSelect
                                    label="Tiền tệ"
                                    value={settings.currency}
                                    onChange={(e: any) => setSettings({ ...settings, currency: e.target.value })}
                                    options={currencies.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} - ${c.name}` }))}
                                />

                                <FormSelect
                                    label="Timezone"
                                    value={settings.timezone}
                                    onChange={(e: any) => setSettings({ ...settings, timezone: e.target.value })}
                                    options={timezones}
                                />
                                <FormInput
                                    label="Default Tax Rate (%)"
                                    value={settings.taxRate.toString()}
                                    onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                                    type="number"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Receipt Customization */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('receipt')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary-900" />
                            Receipt Customization
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.receipt ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.receipt && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Receipt Footer Message
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.receiptFooter}
                                        onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent"
                                        placeholder="Thank you for your business!"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Terms and Conditions
                                    </label>
                                    <textarea
                                        value={settings.termsAndConditions}
                                        onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent"
                                        placeholder="Enter your terms and conditions..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* --- MỚI: QUẢN LÝ MÃ QR THANH TOÁN --- */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('qrcode')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-primary-900" />
                            Quản lý Mã QR Thanh Toán
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.qrcode ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.qrcode && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-primary-900" />
                                Quản lý Mã QR Thanh Toán
                            </h2>

                            {/* Danh sách QR đã thêm */}
                            {settings.qrCodes && settings.qrCodes.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {settings.qrCodes.map((qr, index) => (
                                        <div key={index} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                                            {qr.image ? (
                                                <img src={qr.image} alt="QR" className="w-20 h-20 object-contain bg-white border rounded" />
                                            ) : (
                                                <div className="w-20 h-20 bg-gray-200 flex items-center justify-center text-xs text-gray-500 rounded">No Image</div>
                                            )}
                                            <div>
                                                <p className="font-bold text-gray-900">{qr.name}</p>
                                                <p className="text-sm text-gray-600">{qr.bankName}</p>
                                                <p className="text-sm font-mono text-gray-800">{qr.accountNumber}</p>
                                                <p className="text-[10px] text-primary-600 font-mono mt-1 border border-primary-200 bg-primary-50 inline-block px-1 rounded">ID: {qr.qrId}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSettings({ ...settings, qrCodes: settings.qrCodes.filter((_, i) => i !== index) })}
                                                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Form thêm QR mới */}
                            <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Thêm mã QR mới</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <FormInput label="Tên gợi nhớ (VD: Momo, VCB...)" value={newQr.name} onChange={(e) => setNewQr({ ...newQr, name: e.target.value })} />
                                    <FormInput label="Tên Ngân Hàng / Ví" value={newQr.bankName} onChange={(e) => setNewQr({ ...newQr, bankName: e.target.value })} />
                                    <FormInput label="Số Tài Khoản" value={newQr.accountNumber} onChange={(e) => setNewQr({ ...newQr, accountNumber: e.target.value })} />
                                </div>
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Hình ảnh Mã QR</label>
                                        <input
                                            type="file" accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setNewQr({ ...newQr, image: reader.result as string });
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!newQr.name || !newQr.image) return alert("Vui lòng nhập tên và chọn ảnh QR");
                                            const qrWithId = { ...newQr, qrId: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
                                            setSettings({ ...settings, qrCodes: [...(settings.qrCodes || []), qrWithId] });
                                            setNewQr({ name: "", bankName: "", accountNumber: "", image: "" }); // Reset form
                                        }}
                                        className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-bold hover:bg-primary-800 h-10"
                                    >
                                        Thêm Mã QR
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* SMS Settings (Twilio) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('sms')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary-900" />
                            SMS Settings (Twilio)
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.sms ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.sms && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border border-primary-100">
                                    <input
                                        type="checkbox"
                                        id="smsEnabled"
                                        checked={settings.smsEnabled}
                                        onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })}
                                        className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                    />
                                    <label htmlFor="smsEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                        Enable SMS Notifications
                                    </label>
                                </div>
                                {settings.smsEnabled && (
                                    <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-primary-200">
                                        <FormInput
                                            label="Twilio Account SID"
                                            value={settings.twilioAccountSid}
                                            onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                        />
                                        <FormInput
                                            label="Twilio Auth Token"
                                            type="password"
                                            value={settings.twilioAuthToken}
                                            onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                                            placeholder="Your Twilio Auth Token"
                                        />
                                        <FormInput
                                            label="Twilio Phone Number"
                                            value={settings.twilioPhoneNumber}
                                            onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
                                            placeholder="+1234567890"
                                        />
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <p className="text-xs text-yellow-800">
                                                <strong>Note:</strong> Get your Twilio credentials from <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="underline">Twilio Console</a>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Settings (SMTP) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('email')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Send className="w-5 h-5 text-primary-900" />
                            Email Settings (SMTP)
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.email ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.email && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                                    <input
                                        type="checkbox"
                                        id="emailEnabled"
                                        checked={settings.emailEnabled}
                                        onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                                        className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                    />
                                    <label htmlFor="emailEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                        Enable Email Notifications
                                    </label>
                                </div>
                                {settings.emailEnabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-green-200">
                                        <FormInput
                                            label="SMTP Host"
                                            value={settings.smtpHost}
                                            onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                            placeholder="smtp.gmail.com"
                                        />
                                        <FormInput
                                            label="SMTP Port"
                                            type="number"
                                            value={settings.smtpPort.toString()}
                                            onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                                            placeholder="587"
                                        />
                                        <FormInput
                                            label="SMTP Username"
                                            value={settings.smtpUser}
                                            onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                                            placeholder="your_email@gmail.com"
                                        />
                                        <FormInput
                                            label="SMTP Password"
                                            type="password"
                                            value={settings.smtpPassword}
                                            onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                                            placeholder="Your app password"
                                        />
                                        <div className="md:col-span-2">
                                            <FormInput
                                                label="From Email Address"
                                                value={settings.smtpFrom}
                                                onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                                                placeholder='"Your Salon" <noreply@yoursalon.com>'
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <input
                                                type="checkbox"
                                                id="smtpSecure"
                                                checked={settings.smtpSecure}
                                                onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                                                className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                            />
                                            <label htmlFor="smtpSecure" className="text-sm text-gray-700 cursor-pointer">
                                                Use SSL/TLS (Enable for port 465, disable for port 587)
                                            </label>
                                        </div>
                                        <div className="md:col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <p className="text-xs text-yellow-800">
                                                <strong>Gmail Users:</strong> Use port 587, enable 2FA, and generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">App Password</a>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Reminder Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('reminder')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary-900" />
                            Appointment Reminder Settings
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.reminder ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.reminder && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput
                                    label="Send Reminders (Days Before)"
                                    type="number"
                                    value={settings.reminderDaysBefore.toString()}
                                    onChange={(e) => setSettings({ ...settings, reminderDaysBefore: parseInt(e.target.value) || 1 })}
                                    min="0"
                                    max="7"
                                    placeholder="1"
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Reminder Methods
                                    </label>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="reminder-sms"
                                                checked={(settings.reminderMethods || []).includes('sms')}
                                                onChange={(e) => {
                                                    const currentMethods = settings.reminderMethods || [];
                                                    const methods = e.target.checked
                                                        ? [...currentMethods, 'sms']
                                                        : currentMethods.filter(m => m !== 'sms');
                                                    setSettings({ ...settings, reminderMethods: methods });
                                                }}
                                                className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                            />
                                            <label htmlFor="reminder-sms" className="text-sm font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-primary-600" />
                                                SMS
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="reminder-email"
                                                checked={(settings.reminderMethods || []).includes('email')}
                                                onChange={(e) => {
                                                    const currentMethods = settings.reminderMethods || [];
                                                    const methods = e.target.checked
                                                        ? [...currentMethods, 'email']
                                                        : currentMethods.filter(m => m !== 'email');
                                                    setSettings({ ...settings, reminderMethods: methods });
                                                }}
                                                className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                            />
                                            <label htmlFor="reminder-email" className="text-sm font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-green-600" />
                                                Email
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="reminder-zalo"
                                                checked={(settings.reminderMethods || []).includes('zalo')}
                                                onChange={(e) => {
                                                    const currentMethods = settings.reminderMethods || [];
                                                    const methods = e.target.checked
                                                        ? [...currentMethods, 'zalo']
                                                        : currentMethods.filter(m => m !== 'zalo');
                                                    setSettings({ ...settings, reminderMethods: methods });
                                                }}
                                                className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                            />
                                            <label htmlFor="reminder-zalo" className="text-sm font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-primary-500" />
                                                Zalo ZNS
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                                <p className="text-sm text-primary-800">
                                    <strong>Note:</strong> Reminders will be sent automatically {settings.reminderDaysBefore} day(s) before appointments via {
                                        (settings.reminderMethods || []).length === 0 ? 'No methods selected' :
                                            (settings.reminderMethods || []).map(method => {
                                                switch (method) {
                                                    case 'sms': return 'SMS';
                                                    case 'email': return 'Email';
                                                    case 'zalo': return 'Zalo ZNS';
                                                    default: return method;
                                                }
                                            }).join(', ')
                                    }.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                {/* --- KHỐI CẤU HÌNH ZALO ZNS --- */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('zalo')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary-900" />
                            Tích hợp Zalo ZNS
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.zalo ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.zalo && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border border-primary-100">
                                <input
                                    type="checkbox"
                                    id="zaloEnabled"
                                    checked={settings.zaloEnabled}
                                    onChange={(e) => setSettings({ ...settings, zaloEnabled: e.target.checked })}
                                    className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                />
                                <label htmlFor="zaloEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                    Enable Zalo ZNS Notifications
                                </label>
                            </div>

                            {settings.zaloEnabled && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Zalo App ID</label>
                                        <input
                                            type="text"
                                            value={settings.zaloAppId}
                                            onChange={(e) => setSettings({ ...settings, zaloAppId: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-primary-900 bg-gray-50 focus:bg-white transition-colors text-sm"
                                            placeholder="VD: 123456789012345678"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Zalo Secret Key</label>
                                        <input
                                            type="password"
                                            value={settings.zaloSecretKey}
                                            onChange={(e) => setSettings({ ...settings, zaloSecretKey: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-primary-900 bg-gray-50 focus:bg-white transition-colors text-sm"
                                            placeholder="Chuỗi bí mật của ứng dụng"
                                        />
                                    </div>
                                    <div className="md:col-span-2 mt-4 border-t border-gray-100 pt-4">
                                        <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Quản lý Mẫu tin nhắn (Template IDs)</label>
                                        <div className="space-y-3">
                                            {settings.zaloTemplates && Array.isArray(settings.zaloTemplates) && settings.zaloTemplates.length > 0 ? (
                                                settings.zaloTemplates.map((template, index) => (
                                                    <div key={template.eventType} className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-3 rounded-lg border border-gray-200">
                                                        <div className="md:w-1/3">
                                                            <p className="text-sm font-bold text-gray-800">{template.name}</p>
                                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{template.eventType}</p>
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                value={template.templateId || ''}
                                                                onChange={(e) => handleTemplateChange(index, e.target.value)}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-900 outline-none text-sm"
                                                                placeholder="Nhập Template ID từ Zalo..."
                                                            />
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                                                    <p className="text-sm text-gray-600">Không có mẫu tin nhắn nào</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Access Token</label>
                                        <textarea
                                            value={settings.zaloAccessToken}
                                            onChange={(e) => setSettings({ ...settings, zaloAccessToken: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-primary-900 bg-gray-50 focus:bg-white transition-colors text-xs font-mono"
                                            rows={2}
                                            placeholder="Dán Access Token vào đây (Chỉ cần làm lần đầu tiên)"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Refresh Token</label>
                                        <textarea
                                            value={settings.zaloRefreshToken}
                                            onChange={(e) => setSettings({ ...settings, zaloRefreshToken: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-primary-900 bg-gray-50 focus:bg-white transition-colors text-xs font-mono text-red-600"
                                            rows={2}
                                            placeholder="Dán Refresh Token vào đây (Quan trọng: Dùng để hệ thống tự động gia hạn)"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1 italic">* Hệ thống sẽ tự động sử dụng Refresh Token để gia hạn mã Zalo mỗi khi hết hạn.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* --- KẾT THÚC KHỐI ZALO --- */}
                {/* AI Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleTab('ai')}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary-900" />
                            AI Power Reporting Settings
                        </h2>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-600 transition-transform ${openTabs.ai ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {openTabs.ai && (
                        <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border border-primary-100">
                                    <input
                                        type="checkbox"
                                        id="aiEnabled"
                                        checked={settings.aiEnabled}
                                        onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
                                        className="w-4 h-4 text-primary-900 rounded focus:ring-primary-900"
                                    />
                                    <label htmlFor="aiEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                        Enable AI Powered Insights & Reporting
                                    </label>
                                </div>
                                {settings.aiEnabled && (
                                    <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-primary-200">
                                        <FormInput
                                            label="OpenAI API Key"
                                            type="password"
                                            value={settings.openaiApiKey}
                                            onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                                            placeholder="sk-..."
                                        />
                                        <FormSelect
                                            label="OpenAI Model"
                                            value={settings.openaiModel}
                                            onChange={(e: any) => setSettings({ ...settings, openaiModel: e.target.value })}
                                            options={[
                                                { value: "gpt-4o", label: "GPT-4o (Recommended)" },
                                                { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster/Cheaper)" },
                                                { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
                                                { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
                                            ]}
                                        />
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <p className="text-xs text-yellow-800">
                                                <strong>Note:</strong> Your API key is stored securely. Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Dashboard</a>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* System Management */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary-900" />
                        System Management
                    </h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Database Backup</h3>
                                <p className="text-xs text-gray-500 mt-1">Export all your business data to a JSON file for safety.</p>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        window.location.href = '/api/settings/backup';
                                    } catch (error) {
                                        console.error("Backup failed:", error);
                                        alert("Backup failed. Please try again.");
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-bold hover:bg-primary-800 transition-colors shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                Download Backup
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end sticky bottom-0">
                    <PermissionGate resource="settings" action="edit">
                        <FormButton
                            type="submit"
                            loading={saving}
                            icon={<Save className="w-5 h-5" />}
                        >
                            Save Settings
                        </FormButton>
                    </PermissionGate>
                </div>
            </form>
        </div>
    );
}
