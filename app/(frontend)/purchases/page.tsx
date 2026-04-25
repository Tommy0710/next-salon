
"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, ShoppingBag, Eye, Calendar, ChevronLeft, ChevronRight, Trash2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { FormButton } from "@/components/dashboard/FormInput";
import ActionDropdown from "@/components/dashboard/ActionDropdown";
import { MobileCardList, MobileCard } from "@/components/dashboard/MobileCardList";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatDate } from "@/lib/dateUtils";

export default function PurchasesPage() {
    const { settings } = useSettings();
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    // Deposit States
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
    const [depositAmount, setDepositAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [depositLoading, setDepositLoading] = useState(false);

    useEffect(() => {
        fetchPurchases();
    }, [page, search, statusFilter]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", page.toString());
            query.append("limit", "10");
            if (search) query.append("search", search);
            if (statusFilter !== "all") query.append("status", statusFilter);

            const res = await fetch(`/api/purchases?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setPurchases(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Deleting a 'received' purchase will revert product stock levels.")) return;

        try {
            const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchPurchases();
            } else {
                alert(data.error || "Failed to delete");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting purchase");
        }
    };

    const handleAddDeposit = async () => {
        if (!selectedPurchase || !depositAmount) return;
        setDepositLoading(true);
        try {
            const res = await fetch("/api/purchases/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    purchase: selectedPurchase._id,
                    supplier: selectedPurchase.supplier?._id,
                    amount: Number(depositAmount),
                    paymentMethod,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setShowDepositModal(false);
                setDepositAmount("");
                fetchPurchases();
            } else {
                alert(data.error || "Failed to add deposit");
            }
        } catch (error) {
            console.error(error);
            alert("Error adding deposit");
        } finally {
            setDepositLoading(false);
        }
    };

    return (
        <div className="p-4 min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
                    <p className="text-gray-500 text-sm">Manage supplier purchases and stock intake</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/purchases/create"
                        className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Purchase
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search purchase # or supplier..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:text-white dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700"
                            >
                                <option value="all">All Status</option>
                                <option value="received">Received</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Purchase #</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 dark:border-gray-700 divide-y divide-gray-100">
                            {loading && purchases.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                    </tr>
                                ))
                            ) : purchases.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No purchases found</p>
                                    </td>
                                </tr>
                            ) : (
                                purchases.map((purchase) => (
                                    <tr key={purchase._id} className="hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{purchase.purchaseNumber}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-700">{purchase.supplier?.name || "Unknown"}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-sm">{formatDate(purchase.date, settings.timezone)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{settings.symbol}{purchase.totalAmount.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' :
                                                purchase.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                {purchase.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${purchase.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                                                purchase.paymentStatus === 'partially_paid' ? 'bg-primary-50 text-primary-700 border-primary-200' :
                                                    'bg-orange-50 text-orange-700 border-orange-200'
                                                }`}>
                                                {purchase.paymentStatus?.replace('_', ' ') || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="relative flex justify-end">
                                                <ActionDropdown items={[
                                                    { label: "View Details", icon: <Eye className="w-4 h-4" />, href: `/purchases/${purchase._id}` },
                                                    { label: "Add Deposit", icon: <Wallet className="w-4 h-4" />, variant: "success", hidden: purchase.paymentStatus === 'paid', onClick: () => { setSelectedPurchase(purchase); setShowDepositModal(true); } },
                                                    { label: "Delete Purchase", icon: <Trash2 className="w-4 h-4" />, variant: "danger", dividerBefore: true, onClick: () => handleDelete(purchase._id) },
                                                ]} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <MobileCardList
                    items={purchases}
                    loading={loading}
                    emptyIcon={<ShoppingBag className="w-14 h-14" />}
                    emptyText="No purchases found"
                    renderItem={(purchase) => {
                        const statusDot: Record<string, string> = { received: 'bg-emerald-400', pending: 'bg-amber-400', cancelled: 'bg-gray-400' };
                        const paymentDot: Record<string, string> = { paid: 'bg-emerald-400', partially_paid: 'bg-blue-400', unpaid: 'bg-orange-400' };
                        return (
                            <MobileCard accentColor={statusDot[purchase.status] ?? 'bg-gray-400'}>
                                <div className="absolute right-1 top-1 z-20">
                                    <ActionDropdown items={[
                                        { label: "View Details", icon: <Eye className="w-4 h-4" />, href: `/purchases/${purchase._id}` },
                                        { label: "Add Deposit", icon: <Wallet className="w-4 h-4" />, variant: "success", hidden: purchase.paymentStatus === 'paid', onClick: () => { setSelectedPurchase(purchase); setShowDepositModal(true); } },
                                        { label: "Delete", icon: <Trash2 className="w-4 h-4" />, variant: "danger", dividerBefore: true, onClick: () => handleDelete(purchase._id) },
                                    ]} />
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-800 pl-3">
                                    <div className="px-3 py-3 pr-6 flex flex-col gap-2 min-w-0">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg shrink-0">
                                                <ShoppingBag className="w-3.5 h-3.5 text-primary-700 dark:text-primary-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{purchase.purchaseNumber}</div>
                                                <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate">{purchase.supplier?.name || 'Unknown'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(purchase.date, settings.timezone)}
                                        </div>
                                    </div>
                                    <div className="px-3 py-3 flex flex-col gap-2 min-w-0">
                                        <div className="text-[14px] font-black text-gray-900 dark:text-white">{settings.symbol}{purchase.totalAmount.toFixed(2)}</div>
                                        <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${purchase.status === 'received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : purchase.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[purchase.status] ?? 'bg-gray-400'}`} />
                                            {purchase.status}
                                        </span>
                                        <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${purchase.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : purchase.paymentStatus === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${paymentDot[purchase.paymentStatus] ?? 'bg-orange-400'}`} />
                                            {purchase.paymentStatus?.replace('_', ' ') || 'Unpaid'}
                                        </span>
                                    </div>
                                </div>
                            </MobileCard>
                        );
                    }}
                />

                {/* Pagination - Reuse logic from other pages */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:text-white dark:bg-slate-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-sm text-gray-500 font-medium">
                        Showing <span className="text-gray-900 dark:text-white">{purchases.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> purchases
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => page > 1 && setPage(page - 1)}
                            disabled={page <= 1}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-semibold text-gray-700">Page {page} of {pagination.pages || 1}</span>
                        <button
                            onClick={() => page < pagination.pages && setPage(page + 1)}
                            disabled={page >= pagination.pages}
                            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Deposit Modal */}
            {showDepositModal && selectedPurchase && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-900 text-white">
                            <div>
                                <h3 className="text-xl font-bold">Add Deposit</h3>
                                <p className="text-primary-200 text-xs mt-1">Order: {selectedPurchase.purchaseNumber}</p>
                            </div>
                            <button onClick={() => setShowDepositModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 rounded-xl border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Amount</p>
                                    <p className="text-lg font-black text-gray-900 dark:text-white">{settings.symbol}{selectedPurchase.totalAmount.toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Due Amount</p>
                                    <p className="text-lg font-black text-red-700">{settings.symbol}{(selectedPurchase.totalAmount - selectedPurchase.paidAmount).toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Deposit Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{settings.symbol}</span>
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all font-bold text-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all font-semibold text-gray-700"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Bank Transfer / Card</option>
                                        <option value="Check">Check</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowDepositModal(false)}
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-white transition-all"
                            >
                                Cancel
                            </button>
                            <FormButton
                                onClick={handleAddDeposit}
                                loading={depositLoading}
                                disabled={!depositAmount}
                                className="flex-[2] py-3"
                                icon={<Wallet className="w-4 h-4" />}
                            >
                                Confirm Payment
                            </FormButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
