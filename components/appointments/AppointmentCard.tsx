"use client";

import { format } from "date-fns";
import {
    Clock,
    User,
    MoreVertical,
    Eye,
    CheckCircle,
    Edit,
    Trash2,
    X,
    Tag,
    Scissors,
    DollarSign,
    Hash,
    Globe,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface Service {
    _id: string;
    name: string;
    duration: number;
    price: number;
}

interface Staff {
    _id: string;
    name: string;
    commissionRate: number;
}

interface Customer {
    _id: string;
    name: string;
    phone?: string;
}

interface Appointment {
    _id: string;
    customer: Customer;
    staff?: Staff;
    services: { service: Service; name: string; price: number; duration: number }[];
    date: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    discount: { type: "percentage" | "fixed"; value: number };
    commission: number;
    status: string;
    notes?: string;
    source?: string;
    bookingCode?: string;
    createdAt?: string;
}

interface AppointmentCardProps {
    apt: Appointment;
    activeDropdown: string | null;
    onToggleDropdown: (id: string | null) => void;
    onOpenDetail: (apt: Appointment) => void;
    onStatusUpdate: (id: string, status: string, sendZalo?: boolean) => void;
    onEdit: (apt: Appointment) => void;
    onDelete: (id: string) => void;
}

const statusConfig: Record<
    string,
    { label: string; bg: string; text: string; border: string; dot: string }
> = {
    confirmed: {
        label: "Confirmed",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-200 dark:border-emerald-800/40",
        dot: "bg-emerald-500",
    },
    completed: {
        label: "Completed",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800/40",
        dot: "bg-blue-500",
    },
    pending: {
        label: "Pending",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800/40",
        dot: "bg-amber-400",
    },
    cancelled: {
        label: "Cancelled",
        bg: "bg-gray-100 dark:bg-slate-800",
        text: "text-gray-500 dark:text-gray-400",
        border: "border-gray-200 dark:border-slate-700",
        dot: "bg-gray-400",
    },
};

export default function AppointmentCard({
    apt,
    activeDropdown,
    onToggleDropdown,
    onOpenDetail,
    onStatusUpdate,
    onEdit,
    onDelete,
}: AppointmentCardProps) {
    const status = statusConfig[apt.status] ?? statusConfig.cancelled;
    const totalDuration = apt.services.reduce((s, sv) => s + sv.duration, 0);
    const isOpen = activeDropdown === apt._id;

    return (
        <div className="relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.995] transition-all duration-200 overflow-hidden">
            {/* Status accent bar */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${status.dot}`}
                style={{ borderRadius: "4px 0 0 4px" }}
            />

            {/* Action Button — absolute top-right */}
            <div className="absolute right-1 top-1 z-20 dropdown-trigger">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleDropdown(isOpen ? null : apt._id);
                    }}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                    aria-label="More actions"
                >
                    <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute right-0 top-full mt-1 w-64 p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                        {/* <button
                            onClick={() => {
                                onOpenDetail(apt);
                                onToggleDropdown(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            Xem thông tin
                        </button> */}

                        {apt.status !== "completed" && (
                            <button
                                onClick={() => {
                                    onStatusUpdate(apt._id, "completed");
                                    onToggleDropdown(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Complete
                            </button>
                        )}

                        {apt.status === "pending" && (
                            <button
                                onClick={() => {
                                    onStatusUpdate(apt._id, "confirmed", true);
                                    onToggleDropdown(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Confirm
                            </button>
                        )}

                        {apt.status !== "cancelled" && apt.status !== "completed" && (
                            <button
                                onClick={() => {
                                    onStatusUpdate(apt._id, "cancelled", true);
                                    onToggleDropdown(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        )}

                        <button
                            onClick={() => {
                                onEdit(apt);
                                onToggleDropdown(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Edit className="w-4 h-4 text-blue-500" />
                            Edit Details
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

                        <button
                            onClick={() => {
                                onDelete(apt._id);
                                onToggleDropdown(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Card Body: 2 columns */}
            <div className="grid grid-cols-[1fr_1fr] divide-x divide-gray-100 dark:divide-slate-800 pl-3">
                {/* ── COL 1: Booking Info ── */}
                <div className="px-3 py-3 pr-4 flex flex-col gap-2.5 min-w-0">
                    {/* Date & Time */}
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5 p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg shrink-0">
                            <Clock className="w-3.5 h-3.5 text-primary-700 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight">
                                {format(new Date(apt.date), "dd MMM yyyy")}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                {apt.startTime} – {apt.endTime}
                            </div>
                        </div>
                    </div>

                    {/* Source */}
                    {apt.source && (
                        <div className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">
                                {apt.source}
                            </span>
                        </div>
                    )}

                    {/* Booking Code */}
                    <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-[11px] font-mono font-bold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded truncate">
                            {apt.bookingCode || "N/A"}
                        </span>
                    </div>

                    {/* Customer */}
                    <div className="flex items-start gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">
                                {apt.customer?.name}
                            </div>
                            {apt.customer?.phone && (
                                <div className="text-[10px] text-gray-400 truncate">
                                    {apt.customer.phone}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Staff */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Scissors className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                            {apt.staff?.name || (
                                <span className="text-gray-400 italic">No staff</span>
                            )}
                        </span>
                    </div>


                </div>

                {/* ── COL 2: Services & Price ── */}
                <div className="px-3 py-3 flex flex-col gap-2.5 min-w-0">
                    {/* Services */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Tag className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                Services
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {apt.services.slice(0, 2).map((s, idx) => (
                                <span
                                    key={idx}
                                    title={s.name}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-800/30 max-w-full"
                                >
                                    {s.name}
                                </span>
                            ))}
                            {apt.services.length > 2 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    +{apt.services.length - 2}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                            {apt.services.length} svc · {totalDuration} min
                        </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-1.5">
                        {/* <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" /> */}
                        <span className="text-[14px] font-black text-gray-900 dark:text-white">
                            {formatCurrency(apt.totalAmount)}
                        </span>
                    </div>

                    {/* Status badge */}
                    <div className="mt-auto pt-1">
                        <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.bg} ${status.text} ${status.border}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
