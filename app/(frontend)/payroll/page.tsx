"use client";

import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { DollarSign, Calendar, User, TrendingUp, Download, Plus, Eye, Check, X, Edit, Trash2, Search, Filter, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import Modal from "@/components/dashboard/Modal";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { FormButton } from "@/components/dashboard/FormInput";
import ActionDropdown from "@/components/dashboard/ActionDropdown";
import { MobileCardList, MobileCard } from "@/components/dashboard/MobileCardList";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";

interface Payroll {
    _id: string;
    staff: { _id: string; name: string };
    month: number;
    year: number;
    baseSalary: number;
    totalCommission: number;
    totalTips: number;
    bonuses: number;
    deductions: number;
    totalAmount: number;
    status: string;
    breakdown: any;
    notes?: string;
}

interface Staff {
    _id: string;
    name: string;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function PayrollPage() {
    const { settings } = useSettings();
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
    const [generating, setGenerating] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [updating, setUpdating] = useState(false);

    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedStaff, setSelectedStaff] = useState("");

    useEffect(() => {
        fetchData();
    }, [search, page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [payrollRes, staffRes] = await Promise.all([
                fetch(`/api/payroll?search=${search}&page=${page}&limit=10`),
                fetch("/api/staff")
            ]);

            const payrollData = await payrollRes.json();
            const staffData = await staffRes.json();

            if (payrollData.success) {
                setPayrolls(payrollData.data);
                if (payrollData.pagination) setPagination(payrollData.pagination);
            }
            if (staffData.success) setStaff(staffData.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayroll = async () => {
        if (!selectedStaff) {
            toast.error("Please select a staff member");
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId: selectedStaff,
                    month: selectedMonth,
                    year: selectedYear
                })
            });

            const data = await res.json();
            if (data.success) {
                fetchData();
                setIsGenerateModalOpen(false);
                setSelectedStaff("");
            } else {
                toast.error(data.error || "Failed to generate payroll");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error generating payroll");
        } finally {
            setGenerating(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/payroll/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, paidDate: status === "paid" ? new Date() : null })
            });

            if ((await res.json()).success) {
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this payroll record?")) return;
        try {
            const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchData();
                setIsDetailModalOpen(false);
                setSelectedPayroll(null);
            } else {
                toast.error(data.error || "Failed to delete payroll");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const viewDetails = (payroll: Payroll) => {
        setSelectedPayroll(payroll);
        setEditPayrollData({
            bonuses: payroll.bonuses,
            deductions: payroll.deductions,
            notes: payroll.notes || ""
        });
        setIsDetailModalOpen(true);
    };

    const [editPayrollData, setEditPayrollData] = useState({
        bonuses: 0,
        deductions: 0,
        notes: ""
    });

    const handleUpdatePayrollDetails = async () => {
        if (!selectedPayroll) return;
        setUpdating(true);
        try {
            const totalAmount = selectedPayroll.baseSalary + selectedPayroll.totalCommission + selectedPayroll.totalTips + editPayrollData.bonuses - editPayrollData.deductions;

            const res = await fetch(`/api/payroll/${selectedPayroll._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...editPayrollData,
                    totalAmount
                })
            });

            if ((await res.json()).success) {
                fetchData();
                setIsDetailModalOpen(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid": return "bg-green-100 text-green-700 border-green-200";
            case "approved": return "bg-primary-100 text-primary-700 border-primary-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll & Commission</h1>
                        <p className="text-sm text-gray-500">Manage staff salaries, commissions, and tips</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsGenerateModalOpen(true)}
                            className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Generate Payroll
                        </button>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden text-black">
                    {/* Filters Bar */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-gray-700/50">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by staff name..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:text-white dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={() => { setSearch(""); setPage(1); }}
                                className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Salary</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commission</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tips</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 dark:border-gray-700 divide-y divide-gray-100">
                                {loading && payrolls.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : payrolls.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No payroll records found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    payrolls.map((payroll) => (
                                        <tr key={payroll._id} className="hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                                        {payroll.staff.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{payroll.staff.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                    {MONTHS[payroll.month - 1]} {payroll.year}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {settings.symbol}{payroll.baseSalary.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-white">
                                                {settings.symbol}{payroll.totalCommission.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-white">
                                                {settings.symbol}{payroll.totalTips.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                                {settings.symbol}{payroll.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(payroll.status)}`}>
                                                    {payroll.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="relative flex justify-end">
                                                    <ActionDropdown items={[
                                                        { label: "View Details", icon: <FileText className="w-4 h-4" />, onClick: () => viewDetails(payroll) },
                                                        { label: "Approve", icon: <Check className="w-4 h-4" />, variant: "success", hidden: payroll.status !== "draft", onClick: () => handleStatusUpdate(payroll._id, "approved") },
                                                        { label: "Mark as Paid", icon: <DollarSign className="w-4 h-4" />, variant: "success", hidden: payroll.status !== "approved", onClick: () => handleStatusUpdate(payroll._id, "paid") },
                                                        { label: "Delete Record", icon: <Trash2 className="w-4 h-4" />, variant: "danger", dividerBefore: true, onClick: () => handleDelete(payroll._id) },
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
                        items={payrolls}
                        loading={loading}
                        emptyIcon={<DollarSign className="w-14 h-14" />}
                        emptyText="No payroll records found"
                        renderItem={(payroll) => (
                            <MobileCard accentColor={payroll.status === 'paid' ? 'bg-emerald-400' : payroll.status === 'approved' ? 'bg-blue-400' : 'bg-gray-300'}>
                                <div className="absolute right-1 top-1 z-1">
                                    <ActionDropdown items={[
                                        { label: "View Details", icon: <FileText className="w-4 h-4" />, onClick: () => viewDetails(payroll) },
                                        { label: "Approve", icon: <Check className="w-4 h-4" />, variant: "success", hidden: payroll.status !== "draft", onClick: () => handleStatusUpdate(payroll._id, "approved") },
                                        { label: "Mark as Paid", icon: <DollarSign className="w-4 h-4" />, variant: "success", hidden: payroll.status !== "approved", onClick: () => handleStatusUpdate(payroll._id, "paid") },
                                        { label: "Delete Record", icon: <Trash2 className="w-4 h-4" />, variant: "danger", dividerBefore: true, onClick: () => handleDelete(payroll._id) },
                                    ]} />
                                </div>
                                <div className="pl-4 pr-10 py-3 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                                            {payroll.staff.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-gray-900 dark:text-white">{payroll.staff.name}</div>
                                            <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <Calendar className="w-3 h-3" />
                                                {MONTHS[payroll.month - 1]} {payroll.year}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                        <div>
                                            <div className="text-gray-400">Salary</div>
                                            <div className="font-semibold text-gray-800 dark:text-white">{settings.symbol}{payroll.baseSalary.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-400">Commission</div>
                                            <div className="font-semibold text-green-600">{settings.symbol}{payroll.totalCommission.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-400">Total</div>
                                            <div className="font-bold text-gray-900 dark:text-white">{settings.symbol}{payroll.totalAmount.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <span className={`self-start inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(payroll.status)}`}>
                                        {payroll.status}
                                    </span>
                                </div>
                            </MobileCard>
                        )}
                    />

                    {/* Pagination */}
                    <div className="flex-col md:flex-row gap-4 px-6 py-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:text-white dark:bg-slate-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="text-sm text-gray-500 font-medium">
                            Showing <span className="text-gray-900 dark:text-white">{payrolls.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> records
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => page > 1 && setPage(page - 1)}
                                disabled={page <= 1}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                                            onClick={() => setPage(pageNum)}
                                            className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === pageNum
                                                ? "bg-primary-900 text-white"
                                                : "text-gray-600 hover:bg-gray-100"
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
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
            </div>

            {/* Generate Payroll Modal */}
            <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="Generate Payroll">
                <div className="space-y-4">
                    <SearchableSelect
                        label="Staff Member"
                        placeholder="Select Staff"
                        required
                        value={selectedStaff}
                        onChange={(val) => setSelectedStaff(val)}
                        options={staff.map(s => ({ value: s._id, label: s.name }))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Month"
                            value={selectedMonth.toString()}
                            onChange={(val) => setSelectedMonth(parseInt(val))}
                            options={MONTHS.map((month, idx) => ({ value: (idx + 1).toString(), label: month }))}
                        />
                        <SearchableSelect
                            label="Year"
                            value={selectedYear.toString()}
                            onChange={(val) => setSelectedYear(parseInt(val))}
                            options={[2024, 2025, 2026].map(year => ({ value: year.toString(), label: year.toString() }))}
                        />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button onClick={() => setIsGenerateModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700">Cancel</button>
                        <FormButton onClick={handleGeneratePayroll} loading={generating}>
                            Generate
                        </FormButton>
                    </div>
                </div>
            </Modal>

            {/* Detail Modal */}
            {selectedPayroll && (
                <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Payroll Details - ${selectedPayroll.staff.name}`}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-500">Period</p>
                                <p className="font-semibold">{MONTHS[selectedPayroll.month - 1]} {selectedPayroll.year}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Status</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedPayroll.status)}`}>
                                    {selectedPayroll.status}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Base Salary</span>
                                <span className="font-semibold">{settings.symbol}{selectedPayroll.baseSalary.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Total Commission</span>
                                <span className="font-semibold text-green-600">{settings.symbol}{selectedPayroll.totalCommission.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600">Total Tips</span>
                                <span className="font-semibold text-primary-600">{settings.symbol}{selectedPayroll.totalTips.toLocaleString()}</span>
                            </div>

                            <div className="pt-2">
                                <label className="text-sm font-medium text-gray-700">Bonuses</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent"
                                    value={editPayrollData.bonuses}
                                    onChange={(e) => setEditPayrollData({ ...editPayrollData, bonuses: parseFloat(e.target.value) || 0 })}
                                    disabled={selectedPayroll.status === "paid"}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700">Deductions</label>
                                <input
                                    type="number"
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent"
                                    value={editPayrollData.deductions}
                                    onChange={(e) => setEditPayrollData({ ...editPayrollData, deductions: parseFloat(e.target.value) || 0 })}
                                    disabled={selectedPayroll.status === "paid"}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700">Notes</label>
                                <textarea
                                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-900 focus:border-transparent"
                                    rows={2}
                                    value={editPayrollData.notes}
                                    onChange={(e) => setEditPayrollData({ ...editPayrollData, notes: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-between py-3 bg-primary-50 px-3 rounded-lg mt-2">
                                <span className="font-bold text-gray-900 dark:text-white">Final Total</span>
                                <span className="font-bold text-primary-900 text-lg">
                                    {settings.symbol}{(selectedPayroll.baseSalary + selectedPayroll.totalCommission + selectedPayroll.totalTips + editPayrollData.bonuses - editPayrollData.deductions).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <button
                                onClick={() => handleDelete(selectedPayroll._id)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Record
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                {selectedPayroll.status !== "paid" && (
                                    <FormButton
                                        onClick={handleUpdatePayrollDetails}
                                        loading={updating}
                                    >
                                        Save Changes
                                    </FormButton>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold text-gray-700">Appointments:</span>
                                <span className="text-gray-600">{selectedPayroll.breakdown?.appointments?.length || 0}</span>
                            </div>
                            {selectedPayroll.breakdown?.invoices?.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-semibold text-gray-700">Direct Sales (POS):</span>
                                        <span className="text-gray-600">{selectedPayroll.breakdown.invoices.length}</span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700 p-3 rounded-lg text-xs space-y-2 max-h-40 overflow-y-auto">
                                        {selectedPayroll.breakdown.invoices.map((inv: any) => (
                                            <div key={inv.invoiceId} className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                                                <span className="text-gray-500">{inv.invoiceNumber} ({format(new Date(inv.date), "dd MMM")})</span>
                                                <span className="font-semibold text-green-600">{settings.symbol}{inv.commission.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
