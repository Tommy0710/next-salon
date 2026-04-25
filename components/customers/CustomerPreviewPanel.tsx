"use client";

import { useEffect, useState } from "react";
import {
    X, User, Mail, Phone, MapPin, Calendar, TrendingUp,
    ShoppingBag, Clock, Award, ChevronRight, Scissors, Package,
    CreditCard, BarChart2, AlertCircle, Wallet
} from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface CustomerProfile {
    customer: {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        notes?: string;
        gender?: string;
        status: number;
        dateOfBirth?: string;
        visitCount?: number;
        totalPurchases: number;
        loyaltyPoints: number;
        walletBalance?: number;
        createdAt: string;
    };
    invoices: {
        _id: string;
        invoiceNumber: string;
        totalAmount: number;
        status: string;
        date: string;
        items: { name: string; itemModel: string; quantity: number; total: number }[];
    }[];
    appointments: {
        _id: string;
        date: string;
        startTime: string;
        status: string;
        services: { name: string }[];
    }[];
    stats: {
        totalRevenue: number;
        totalVisits: number;
        totalInvoices: number;
        avgOrderValue: number;
        topServices: { name: string; count: number; totalSpent: number }[];
        monthlySpend: { month: string; amount: number }[];
    };
}

interface Props {
    customerId: string | null;
    onClose: () => void;
}

const genderLabel: Record<string, string> = {
    male: "Nam",
    female: "Nữ",
    other: "Không xác định",
};

const statusBadge = (status: string) => {
    const map: Record<string, string> = {
        paid: "bg-green-50 text-green-700 border-green-200",
        partially_paid: "bg-yellow-50 text-yellow-700 border-yellow-200",
        pending: "bg-amber-50 text-amber-700 border-amber-200",
        cancelled: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700",
    };
    return map[status] || "bg-gray-100 text-gray-500";
};

const apptStatusBadge = (status: string) => {
    const map: Record<string, string> = {
        confirmed: "bg-green-50 text-green-700 border-green-200",
        completed: "bg-blue-50 text-blue-700 border-blue-200",
        pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
        cancelled: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700",
        "no-show": "bg-red-50 text-red-600 border-red-200",
    };
    return map[status] || "bg-gray-100 text-gray-500";
};

type Tab = "overview" | "invoices" | "appointments";

// ─── Inner panel content (reused for both mobile modal and desktop panel) ─────
function PanelContent({
    profile,
    loading,
    error,
    tab,
    setTab,
    onClose,
    settings,
}: {
    profile: CustomerProfile | null;
    loading: boolean;
    error: string;
    tab: Tab;
    setTab: (t: Tab) => void;
    onClose: () => void;
    settings: any;
}) {
    const c = profile?.customer;
    const stats = profile?.stats;
    const chartData = stats
        ? stats.monthlySpend.map((m) => {
            const [year, month] = m.month.split("-");
            return { name: `${month}/${year.slice(2)}`, amount: m.amount };
        })
        : [];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Hồ sơ khách hàng
                </span>
                <button
                    onClick={onClose}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* ── Loading / Error ── */}
            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Đang tải...</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="flex-1 flex items-center justify-center px-5">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                        <AlertCircle className="w-8 h-8 opacity-60" />
                        <span className="text-sm text-center">{error}</span>
                    </div>
                </div>
            )}

            {profile && c && (
                <div className="flex-1 overflow-y-auto">
                    {/* ── Avatar + Name ── */}
                    <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm ${c.gender === 'female' ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' : c.gender === 'male' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                                {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-black text-gray-900 dark:text-white truncate">{c.name}</h2>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${c.status === 1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'}`}>
                                        {c.status === 1 ? "Active" : "Inactive"}
                                    </span>
                                    {c.gender && c.gender !== 'other' && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {genderLabel[c.gender] || c.gender}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick contact info */}
                        <div className="mt-4 space-y-2">
                            {c.phone && (
                                <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="font-medium">{c.phone}</span>
                                </div>
                            )}
                            {c.email && (
                                <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{c.email}</span>
                                </div>
                            )}
                            {c.address && (
                                <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{c.address}</span>
                                </div>
                            )}
                            {c.dateOfBirth && (
                                <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span>
                                        {new Date(c.dateOfBirth).toLocaleDateString("vi-VN")}
                                        {" "}
                                        <span className="text-gray-400">
                                            ({new Date().getFullYear() - new Date(c.dateOfBirth).getFullYear()} tuổi)
                                        </span>
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
                                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>Tham gia: {new Date(c.createdAt).toLocaleDateString("vi-VN")}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Wallet Balance ── */}
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800">
                        <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${(c.walletBalance ?? 0) > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40' : 'bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-2.5">
                                <Wallet className={`w-4 h-4 shrink-0 ${(c.walletBalance ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Số dư ví</span>
                            </div>
                            <span className={`text-sm font-black ${(c.walletBalance ?? 0) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                                {formatCurrency(c.walletBalance ?? 0)}
                            </span>
                        </div>
                    </div>

                    {/* ── Stats Row ── */}
                    <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                        {[
                            { icon: TrendingUp, label: "Doanh thu", value: formatCurrency(stats!.totalRevenue, settings.currency), color: "text-emerald-600 dark:text-emerald-400" },
                            { icon: ShoppingBag, label: "Lần ghé thăm", value: stats!.totalVisits.toString(), color: "text-primary-600 dark:text-primary-400" },
                            { icon: CreditCard, label: "Đơn TB", value: formatCurrency(stats!.avgOrderValue, settings.currency), color: "text-violet-600 dark:text-violet-400" },
                            { icon: Award, label: "Điểm tích lũy", value: c.loyaltyPoints?.toString() || "0", color: "text-amber-600 dark:text-amber-400" },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white dark:bg-slate-900 p-4 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wide">{stat.label}</span>
                                </div>
                                <p className={`text-base font-black ${stat.color} truncate`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50">
                        {(["overview", "invoices", "appointments"] as Tab[]).map((t) => {
                            const labels: Record<Tab, string> = { overview: "Tổng quan", invoices: "Hóa đơn", appointments: "Lịch hẹn" };
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors border-b-2 ${tab === t ? "border-primary-900 text-primary-900 dark:text-primary-400 dark:border-primary-400" : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                                >
                                    {labels[t]}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Tab Content ── */}
                    <div className="p-4 space-y-4">

                        {/* OVERVIEW TAB */}
                        {tab === "overview" && (
                            <>
                                {c.notes && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Ghi chú</p>
                                        <p className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{c.notes}</p>
                                    </div>
                                )}
                                {stats!.monthlySpend.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <BarChart2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                Chi tiêu 6 tháng gần nhất
                                            </p>
                                        </div>
                                        <div className="w-full h-32">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData}>
                                                    <defs>
                                                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                    <YAxis hide />
                                                    <Tooltip formatter={(value) => formatCurrency(Number(value), settings.currency)} />
                                                    <Area type="monotone" dataKey="amount" stroke="#6366f1" fillOpacity={1} fill="url(#colorSpend)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                                {stats!.topServices.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Scissors className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Dịch vụ hay dùng</p>
                                        </div>
                                        <div className="space-y-2">
                                            {stats!.topServices.slice(0, 5).map((svc, idx) => (
                                                <div key={svc.name} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                                    <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-50 text-orange-600"}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{svc.name}</p>
                                                        <p className="text-[10px] text-gray-400">{svc.count} lần · {formatCurrency(svc.totalSpent, settings.currency)}</p>
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {stats!.topServices.length === 0 && stats!.monthlySpend.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                        <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Chưa có lịch sử giao dịch</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* INVOICES TAB */}
                        {tab === "invoices" && (
                            <div className="space-y-2">
                                {profile.invoices.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                        <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Chưa có hóa đơn nào</p>
                                    </div>
                                ) : (
                                    profile.invoices.map((inv) => (
                                        <div key={inv._id} className="p-3 border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/70 transition-colors">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-mono font-bold text-primary-900 dark:text-primary-400">#{inv.invoiceNumber}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(inv.status)}`}>
                                                    {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'partially_paid' ? 'TT 1 phần' : inv.status === 'pending' ? 'Chờ thanh toán' : 'Hủy bỏ'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-400">{new Date(inv.date).toLocaleDateString("vi-VN")}</span>
                                                <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(inv.totalAmount, settings.currency)}</span>
                                            </div>
                                            {inv.items?.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {inv.items.slice(0, 3).map((item, i) => (
                                                        <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${item.itemModel === 'Service' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'}`}>
                                                            {item.itemModel === 'Service' ? <Scissors className="w-2.5 h-2.5" /> : <Package className="w-2.5 h-2.5" />}
                                                            {item.name}
                                                        </span>
                                                    ))}
                                                    {inv.items.length > 3 && (
                                                        <span className="text-[9px] text-gray-400">+{inv.items.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* APPOINTMENTS TAB */}
                        {tab === "appointments" && (
                            <div className="space-y-2">
                                {profile.appointments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Chưa có lịch hẹn nào</p>
                                    </div>
                                ) : (
                                    profile.appointments.map((apt) => (
                                        <div key={apt._id} className="p-3 border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800/70 transition-colors">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                        {new Date(apt.date).toLocaleDateString("vi-VN")}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">{apt.startTime}</span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${apptStatusBadge(apt.status)}`}>
                                                    {apt.status === 'confirmed' ? 'Đã xác nhận' : apt.status === 'completed' ? 'Hoàn thành' : apt.status === 'pending' ? 'Chờ xử lý' : apt.status === 'cancelled' ? 'Đã hủy' : 'No-show'}
                                                </span>
                                            </div>
                                            {apt.services?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {apt.services.slice(0, 3).map((svc, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                                                            <Scissors className="w-2.5 h-2.5" />
                                                            {svc.name}
                                                        </span>
                                                    ))}
                                                    {apt.services.length > 3 && (
                                                        <span className="text-[9px] text-gray-400">+{apt.services.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function CustomerPreviewPanel({ customerId, onClose }: Props) {
    const { settings } = useSettings();
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<Tab>("overview");
    const [isMobile, setIsMobile] = useState(false);
    const [isVisible, setIsVisible] = useState(false); // for animation

    // Detect mobile breakpoint
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024); // lg breakpoint
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Fetch profile data
    useEffect(() => {
        if (!customerId) return;
        setProfile(null);
        setError("");
        setLoading(true);
        setTab("overview");
        fetch(`/api/customers/${customerId}/profile`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setProfile(data.data);
                else setError(data.error || "Failed to load profile");
            })
            .catch(() => setError("Network error"))
            .finally(() => setLoading(false));
    }, [customerId]);

    // Animate in when customerId changes on mobile
    useEffect(() => {
        if (!customerId) {
            setIsVisible(false);
            return;
        }
        // Small delay to trigger CSS transition
        const t = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(t);
    }, [customerId]);

    // Handle close with animation on mobile
    const handleClose = () => {
        if (isMobile) {
            setIsVisible(false);
            setTimeout(onClose, 300); // wait for slide-down animation
        } else {
            onClose();
        }
    };

    if (!customerId) return null;

    const panelContent = (
        <PanelContent
            profile={profile}
            loading={loading}
            error={error}
            tab={tab}
            setTab={setTab}
            onClose={handleClose}
            settings={settings}
        />
    );

    // ── MOBILE: Bottom sheet modal ─────────────────────────────────────────────
    if (isMobile) {
        return (
            <>
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    onClick={handleClose}
                />

                {/* Bottom Sheet */}
                <div
                    className={`fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl lg:hidden transition-transform duration-300 ease-out`}
                    style={{
                        height: "85dvh",
                        transform: isVisible ? "translateY(0)" : "translateY(100%)",
                    }}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-3 pb-1 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
                    </div>

                    {panelContent}
                </div>
            </>
        );
    }

    // ── DESKTOP: Side panel ────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 min-w-[360px] max-w-[420px]">
            {panelContent}
        </div>
    );
}
