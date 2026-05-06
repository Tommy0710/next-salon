"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Search, Plus, Trash2, Edit, Eye, FileText, Filter, DollarSign, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import ActionDropdown from "@/components/dashboard/ActionDropdown";
import { MobileCardList, MobileCard } from "@/components/dashboard/MobileCardList";
import Link from "next/link";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatDate } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";

interface Invoice {
    _id: string;
    invoiceNumber: string;
    customer?: {
        _id: string;
        name: string;
        phone: string;
    };
    appointment?: {
        _id: string;
        // bookingCode?: string;
    };
    bookingCode?: string;
    items: any[];
    subtotal: number;
    tax: number;
    totalAmount: number;
    amountPaid: number;
    paymentMethod: string;
    status: 'paid' | 'pending' | 'partially_paid' | 'cancelled';
    staff?: {
        _id: string;
        name: string;
    };
    staffAssignments?: {
        staff: {
            _id: string;
            name: string;
        };
        percentage: number;
        commission: number;
    }[];
    commission: number;
    date: string;
    notes?: string;
    createdAt: string;
}

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function InvoicesPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [pagination, setPagination] = useState<PaginationData>({
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
    });

    // Edit Modal State
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editFormData, setEditFormData] = useState({ status: "", notes: "" });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
    const [paymentData, setPaymentData] = useState({ amount: "", method: "Tiền mặt", selectedQrIndex: 0, notes: "" });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const fetchInvoices = useCallback(async (page = 1, searchQuery = search, status = statusFilter, source = sourceFilter, limit = itemsPerPage) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: searchQuery,
                status: status,
                source: source
            });
            const res = await fetch(`/api/invoices?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setInvoices(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, sourceFilter, itemsPerPage]);

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            fetchInvoices(1, search, statusFilter, sourceFilter);
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [search, statusFilter, sourceFilter, fetchInvoices]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            fetchInvoices(newPage);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa hóa đơn này?")) return;
        try {
            const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(pagination.page);
            }
        } catch (error) {
            console.error("Error deleting invoice:", error);
        }
    };

    const openEditModal = (inv: Invoice) => {
        setEditingInvoice(inv);
        setEditFormData({ status: inv.status, notes: inv.notes || "" });
        setIsEditModalOpen(true);
    };


    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvoice) return;

        setIsEditing(true);
        try {
            const res = await fetch(`/api/invoices/${editingInvoice._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editFormData),
            });
            const data = await res.json();
            if (data.success) {
                fetchInvoices(pagination.page);
                setIsEditModalOpen(false);
                toast.success("Hóa đơn đã được cập nhật!");
            } else {
                toast.error(data.error || "Failed to update invoice");
            }
        } catch (error) {
            console.error("Error editing invoice:", error);
            toast.error("An error occurred");
        } finally {
            setIsEditing(false);
        }
    };

    const openPaymentModal = (inv: Invoice) => {
        setPayingInvoice(inv);
        const due = (inv.totalAmount || 0) - (inv.amountPaid || 0);
        setPaymentData({ amount: due.toString(), method: "Tiền mặt", selectedQrIndex: 0, notes: "" });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payingInvoice) return;

        setSubmitting(true);
        try {
            // Quy đổi sang định dạng mà hệ thống đang lưu
            const paymentMethodString = paymentData.method === 'Mã QR'
                ? `QR Code - ${settings?.qrCodes?.[paymentData.selectedQrIndex]?.bankName || ''}`
                : paymentData.method === 'Cà thẻ'
                    ? 'Card'
                    : 'Cash';
            const selectedQr = settings?.qrCodes?.[paymentData.selectedQrIndex];
            const paymentQrIdString = paymentData.method === 'Mã QR' ? selectedQr?.qrId : null;
            const res = await fetch("/api/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoice: payingInvoice._id,
                    customer: payingInvoice.customer?._id,
                    amount: parseFloat(paymentData.amount),
                    paymentMethod: paymentData.method,
                    paymentQrId: paymentQrIdString,
                    notes: paymentData.notes
                }),
            });
            const data = await res.json();
            if (data.success) {
                setIsPaymentModalOpen(false);
                router.push(`/invoices/print/${payingInvoice._id}`);
            } else {
                toast.error(data.error || "Failed to record payment");
            }
        } catch (error) {
            console.error("Error recording payment:", error);
            toast.error("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hóa đơn & Thanh toán</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Quản lý thanh toán, theo dõi thanh toán từng phần và các khoản phải thu</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/pos"
                        className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo hóa đơn (POS)
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by invoice number or customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto text-black dark:text-white">
                        {/* (SOURCE) */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                            <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <select
                                value={sourceFilter}
                                onChange={(e) => setSourceFilter(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none"
                            >
                                <option value="all">Tất cả nguồn</option>
                                <option value="pos">Từ POS</option>
                                <option value="appointment">Từ Đặt lịch</option>
                            </select>
                        </div>
                        {/* (STATUS) */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                            <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="paid">Paid</option>
                                <option value="partially_paid">Partially Paid</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table — desktop only */}
                <div className="hidden md:block overflow-x-auto text-black dark:text-white">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                        <thead className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hóa đơn / Khách hàng</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nguồn</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tổng tiền</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Đã thanh toán</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Còn lại</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nhân viên (Hoa hồng)</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>Không tìm thấy hóa đơn nào</p>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv._id} className="hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                                    <FileText className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase">{formatDate(inv.date, settings.timezone)}</div>
                                                    <div className="mt-1 flex flex-col">
                                                        <span className="text-xs font-semibold text-primary-700 dark:text-primary-400">{inv.customer?.name || "Walk-in"}</span>
                                                        {inv.customer?.phone && <span className="text-[10px] text-gray-500 dark:text-gray-400">{inv.customer.phone}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap align-middle text-left">
                                            <div className="flex flex-col justify-center items-center">
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${inv.appointment ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                    {inv.appointment ? 'Appointment' : 'POS'}
                                                </span>
                                                {/* 👉 HIỂN THỊ BOOKING CODE NẾU CÓ */}
                                                {inv.bookingCode && (
                                                    <span className="text-[10px] text-gray-400 font-mono mt-1 font-medium">
                                                        #{inv.bookingCode}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(inv.totalAmount)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(inv.amountPaid)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-bold ${((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {formatCurrency((inv.totalAmount || 0) - (inv.amountPaid || 0))}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                inv.status === 'partially_paid' ? 'bg-primary-50 text-primary-700 border-primary-200' :
                                                    inv.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {inv.status?.replace('_', ' ') || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {inv.staffAssignments && inv.staffAssignments.length > 0 ? (
                                                <div className="space-y-1">
                                                    {inv.staffAssignments.map((assignment: any, idx: number) => (
                                                        <div key={idx} className="flex flex-col">
                                                            <span className="text-xs font-medium text-gray-900 dark:text-white leading-tight">{assignment.staff?.name || "Staff"}</span>
                                                            <span className="text-[10px] text-green-600 font-bold leading-tight">{formatCurrency(assignment.commission || 0)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{inv.staff?.name || "N/A"}</div>
                                                    <div className="text-xs text-green-600 font-bold">{formatCurrency(inv.commission || 0)}</div>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="relative flex justify-end dropdown-trigger">
                                                <button
                                                    onClick={() => setActiveDropdown(activeDropdown === inv._id ? null : inv._id)}
                                                    className="p-2 text-gray-400 hover:text-primary-900 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {activeDropdown === inv._id && (
                                                    <div className="absolute right-0 mt-10 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {((inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    openPaymentModal(inv);
                                                                    setActiveDropdown(null);
                                                                }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                                            >
                                                                <DollarSign className="w-4 h-4" />
                                                                Thanh toán
                                                            </button>
                                                        )}
                                                        <Link
                                                            href={`/invoices/print/${inv._id}`}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                            onClick={() => setActiveDropdown(null)}
                                                        >
                                                            <Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                            Xem hóa đơn
                                                        </Link>
                                                        {inv.status === 'pending' && (
                                                            <Link
                                                                href={`/pos?edit=${inv._id}`}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                                onClick={() => setActiveDropdown(null)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                Sửa hóa đơn (POS)
                                                            </Link>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                openEditModal(inv);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                                        >
                                                            <Edit className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                                                            Sửa ghi chú
                                                        </button>
                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                        <button
                                                            onClick={() => {
                                                                handleDelete(inv._id);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Xóa hóa đơn
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card List */}
                <MobileCardList
                    items={invoices}
                    loading={loading}
                    emptyIcon={<FileText className="w-14 h-14" />}
                    emptyText="No invoices found"
                    renderItem={(inv) => {
                        const due = (inv.totalAmount || 0) - (inv.amountPaid || 0);
                        const statusColors: Record<string, string> = {
                            paid: 'bg-emerald-400',
                            partially_paid: 'bg-blue-400',
                            pending: 'bg-amber-400',
                            cancelled: 'bg-gray-400',
                        };
                        return (
                            <MobileCard key={inv._id} accentColor={statusColors[inv.status] ?? 'bg-gray-400'}>
                                <ActionDropdown
                                    className="absolute right-1 top-1 z-1"
                                    items={[
                                        { label: "Record Payment", icon: <DollarSign className="w-4 h-4" />, onClick: () => openPaymentModal(inv), variant: "success", hidden: due <= 0 },
                                        { label: "View Receipt", icon: <Eye className="w-4 h-4" />, href: `/invoices/print/${inv._id}`, variant: "primary" },
                                        { label: "Edit Invoice", icon: <Edit className="w-4 h-4" />, href: `/pos?edit=${inv._id}`, variant: "default", hidden: inv.status !== "pending" },
                                        { label: "Edit Notes", icon: <Edit className="w-4 h-4" />, onClick: () => openEditModal(inv), variant: "warning" },
                                        { label: "Delete", icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(inv._id), variant: "danger", dividerBefore: true },
                                    ]}
                                />
                                {/* 2-col body */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-800 pl-3">
                                    {/* Col 1: Invoice + Customer */}
                                    <div className="px-3 py-3 pr-4 flex flex-col gap-2 min-w-0">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg shrink-0">
                                                <FileText className="w-3.5 h-3.5 text-primary-700 dark:text-primary-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{inv.invoiceNumber}</div>
                                                <div className="text-[10px] text-gray-400 font-medium">{formatDate(inv.date, settings.timezone)}</div>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[12px] font-semibold text-primary-700 dark:text-primary-400 truncate">{inv.customer?.name || 'Walk-in'}</div>
                                            {inv.customer?.phone && <div className="text-[10px] text-gray-400 truncate">{inv.customer.phone}</div>}
                                        </div>
                                        <span className={`self-start text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${inv.appointment ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                            {inv.appointment ? 'Appointment' : 'POS'}
                                        </span>
                                    </div>
                                    {/* Col 2: Amounts + Status */}
                                    <div className="px-3 py-3 flex flex-col gap-2 min-w-0">
                                        <div>
                                            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total</div>
                                            <div className="text-[14px] font-black text-gray-900 dark:text-white">{formatCurrency(inv.totalAmount)}</div>
                                        </div>
                                        {!inv.appointment && inv.staff && (
                                            <div className="flex flex-col items-start">
                                                <div className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{inv.staff?.name}</div>
                                                <div className="text-[10px] text-green-600">{formatCurrency(inv.commission)}</div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-1">
                                            <div>
                                                <div className="text-[9px] text-gray-400 uppercase font-semibold">Paid</div>
                                                <div className="text-[12px] font-bold text-emerald-600">{formatCurrency(inv.amountPaid)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-gray-400 uppercase font-semibold">Due</div>
                                                <div className={`text-[12px] font-bold ${due > 0 ? 'text-red-500' : 'text-gray-400'}`}>{formatCurrency(due)}</div>
                                            </div>
                                        </div>
                                        <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : inv.status === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : inv.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusColors[inv.status] ?? 'bg-gray-400'}`} />
                                            {inv.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            </MobileCard>
                        );
                    }}
                />

                {/* Pagination */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border-t border-gray-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Showing <span className="text-gray-900 dark:text-white">{invoices.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> invoices
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                const newLimit = parseInt(e.target.value);
                                setItemsPerPage(newLimit);
                                fetchInvoices(1, search, statusFilter, sourceFilter);
                            }}
                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                        >
                            <option value="10">10 per page</option>
                            <option value="25">25 per page</option>
                            <option value="50">50 per page</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                let pageNum;
                                if (pagination.pages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.pages - 2) {
                                    pageNum = pagination.pages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${pagination.page === pageNum
                                            ? "bg-primary-900 dark:bg-primary-700 text-white"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.pages}
                            className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Record Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title={`Record Payment for ${payingInvoice?.invoiceNumber}`}
            >
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg mb-4 flex justify-between items-center text-primary-900 dark:text-primary-400">
                        <span className="text-sm font-medium">Total Balance Due</span>
                        <span className="text-xl font-bold">{formatCurrency((payingInvoice ? ((payingInvoice.totalAmount || 0) - (payingInvoice.amountPaid || 0)) : 0))}</span>
                    </div>

                    <FormInput
                        label="Payment Amount"
                        type="number"
                        required
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                        max={payingInvoice ? ((payingInvoice.totalAmount || 0) - (payingInvoice.amountPaid || 0)) : 0}
                    />

                    {/* Phần Giao Diện Chọn Phương Thức Thanh Toán Mới */}
                    <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-2">Payment Method</label>
                        <div className="mb-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                {['Tiền mặt', 'Cà thẻ', 'Mã QR'].map(method => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentData({ ...paymentData, method: method })}
                                        className={`py-2 text-[11px] md:text-xs uppercase tracking-wider font-bold rounded-lg border transition-all ${paymentData.method === method ? 'bg-primary-900 text-white border-primary-900 shadow-sm' : 'bg-white dark:bg-slate-950 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'}`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {/* Hiển thị danh sách QR nếu chọn Mã QR */}
                            {paymentData.method === 'Mã QR' && settings?.qrCodes && settings.qrCodes.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 block">Chọn mã QR hiển thị:</label>
                                    <select
                                        value={paymentData.selectedQrIndex}
                                        onChange={(e) => setPaymentData({ ...paymentData, selectedQrIndex: parseInt(e.target.value) })}
                                        className="w-full p-2 text-xs border border-primary-200 dark:border-primary-900/50 rounded-lg focus:ring-1 focus:ring-primary-900 bg-primary-50/50 dark:bg-primary-900/10 outline-none font-medium text-gray-900 dark:text-white"
                                    >
                                        {settings.qrCodes.map((qr: any, idx: number) => (
                                            <option key={idx} value={idx} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">{qr.name} - {qr.bankName}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <FormInput
                        label="Notes (Optional)"
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                        placeholder="e.g. Received by cashier"
                    />

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all font-medium"
                        >
                            Cancel
                        </button>
                        <FormButton
                            type="submit"
                            loading={submitting}
                            variant="success"
                        >
                            Record {formatCurrency(parseFloat(paymentData.amount || "0"))}
                        </FormButton>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={`Edit Invoice ${editingInvoice?.invoiceNumber}`}
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-1">Trạng thái</label>
                        <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 outline-none transition-all text-gray-900 dark:text-white"
                        >
                            <option value="paid" className="bg-white dark:bg-slate-900">Đã thanh toán</option>
                            <option value="partially_paid" className="bg-white dark:bg-slate-900">Thanh toán từng phần</option>
                            <option value="pending" className="bg-white dark:bg-slate-900">Chờ thanh toán</option>
                            <option value="cancelled" className="bg-white dark:bg-slate-900">Đã hủy</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-1">Ghi chú</label>
                        <textarea
                            value={editFormData.notes}
                            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 outline-none transition-all text-gray-900 dark:text-white"
                            rows={3}
                            placeholder="Add invoice notes..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all font-medium"
                        >
                            Hủy
                        </button>
                        <FormButton
                            type="submit"
                            loading={isEditing}
                        >
                            Lưu thay đổi
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
