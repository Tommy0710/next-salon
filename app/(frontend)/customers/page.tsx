"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, User, Mail, Phone, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";
import CustomerPreviewPanel from "@/components/customers/CustomerPreviewPanel";
import { formatCurrency } from "@/lib/currency";

interface Customer {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    totalPurchases: number;
    status: number;
    gender?: string;
    dateOfBirth?: string;
    visitCount?: number;
    createdAt: string;
}

export default function CustomersPage() {
    const { settings } = useSettings();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        gender: "other",
        dateOfBirth: "",
        status: 1,
    });

    useEffect(() => {
        fetchCustomers();
    }, [search, page]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                search,
                page: page.toString(),
                limit: "10"
            });
            const res = await fetch(`/api/customers?${query}`);
            const data = await res.json();
            if (data.success) {
                setCustomers(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
        setFormError("");
    };

    const openModal = (customer?: Customer) => {
        setFormError("");
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                notes: customer.notes || "",
                gender: (customer as any).gender || "other",
                dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : "",
                status: customer.status,
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: "", email: "", phone: "", address: "", notes: "", gender: "other", dateOfBirth: "", status: 1 });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingCustomer ? `/api/customers/${editingCustomer._id}` : "/api/customers";
            const res = await fetch(url, {
                method: editingCustomer ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                fetchCustomers();
                closeModal();
            } else {
                const errorMessage = data.details ? `Validation failed: ${data.details.join(', ')}` : (data.error || "Something went wrong");
                setFormError(errorMessage);
            }
        } catch (error) {
            console.error(error);
            setFormError("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this customer?")) return;
        const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if ((await res.json()).success) fetchCustomers();
    };

    // ─── Export ─────────────────────────────────────────────────────────────
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : "";
            const res = await fetch(`/api/customers/export${params}`);
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const date = new Date().toISOString().split("T")[0];
            a.download = `customers_${date}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoke sau 1 giây để browser kịp xử lý download
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error(err);
            alert("Export failed. Please try again.");
        } finally {
            // Đảm bảo loading luôn tắt dù download dialog có làm gián đoạn hay không
            setTimeout(() => setExporting(false), 500);
        }
    };

    // ─── Import Modal ────────────────────────────────────────────────────────
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importDragOver, setImportDragOver] = useState(false);
    const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        total: number; imported: number; updated: number; skipped: number;
        errors: { row: number; reason: string }[];
    } | null>(null);

    const openImport = () => {
        setIsImportOpen(true);
        setImportStep(1);
        setImportFile(null);
        setImportPreview({ headers: [], rows: [] });
        setImportResult(null);
    };

    const closeImport = () => {
        setIsImportOpen(false);
    };

    /** Simple CSV row splitter for preview (quoted fields) */
    const splitCSVRow = (line: string): string[] => {
        const cells: string[] = [];
        let field = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQ) {
                if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
                else if (ch === '"') inQ = false;
                else field += ch;
            } else {
                if (ch === '"') inQ = true;
                else if (ch === ',') { cells.push(field.trim()); field = ""; }
                else field += ch;
            }
        }
        cells.push(field.trim());
        return cells;
    };

    const handleFileSelect = (file: File) => {
        if (!file.name.toLowerCase().endsWith(".csv")) {
            alert("Only CSV files are supported.");
            return;
        }
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = (e.target?.result as string) || "";
            const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
            if (lines.length < 1) return;
            const headers = splitCSVRow(lines[0]);
            const rows = lines.slice(1, 11).map((l) => splitCSVRow(l)); // up to 10 preview rows
            setImportPreview({ headers, rows });
        };
        reader.readAsText(file, "UTF-8");
    };

    const handleImportSubmit = async () => {
        if (!importFile) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append("file", importFile);
            const res = await fetch("/api/customers/import", { method: "POST", body: fd });
            const data = await res.json();
            if (data.success) {
                setImportResult(data.data);
                setImportStep(3);
                fetchCustomers();
            } else {
                alert(data.error || "Import failed");
            }
        } catch (err) {
            console.error(err);
            alert("Import failed. Please try again.");
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        window.open("/api/customers/import", "_blank");
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Management</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your customer database and history</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Export Button */}
                        <PermissionGate resource="customers" action="view">
                            <button
                                id="btn-export-customers"
                                onClick={handleExport}
                                disabled={exporting}
                                className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm disabled:opacity-60"
                            >
                                <svg className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {exporting ? "Exporting..." : "Export CSV"}
                            </button>
                        </PermissionGate>

                        {/* Import Button */}
                        <PermissionGate resource="customers" action="create">
                            <button
                                id="btn-import-customers"
                                onClick={openImport}
                                className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Import CSV
                            </button>
                        </PermissionGate>

                        {/* Add Customer Button */}
                        <PermissionGate resource="customers" action="create">
                            <button
                                onClick={() => openModal()}
                                className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Customer
                            </button>
                        </PermissionGate>
                    </div>
                </div>

                {/* Main Card — side panel on desktop, popup on mobile */}
                <div className="flex gap-4 transition-all duration-300">
                    <div className={`${selectedCustomerId ? 'lg:flex-1 lg:min-w-0' : 'w-full'} w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white`}>
                        {/* Filters Bar */}
                        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950/50">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email or phone..."
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => { setSearch(""); setPage(1); }}
                                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm px-2"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto text-black dark:text-white">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                                <thead className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Purchases</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Join Date</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                                    {loading && customers.length === 0 ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                            </tr>
                                        ))
                                    ) : customers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                                <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No customers found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        customers.map((customer) => (
                                            <tr
                                                key={customer._id}
                                                onClick={() => setSelectedCustomerId(selectedCustomerId === customer._id ? null : customer._id)}
                                                className={`cursor-pointer hover:bg-primary-50/60 dark:hover:bg-primary-900/10 transition-colors ${selectedCustomerId === customer._id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-600' : 'dark:bg-slate-900 dark:border-gray-700'}`}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                                            <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{customer.name}</span>
                                                            {customer.address && (
                                                                <div className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]" title={customer.address}>
                                                                    {customer.address}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="space-y-1">
                                                        {customer.email ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                                <Mail className="w-3 h-3 text-gray-400" />
                                                                <span className="truncate max-w-[150px]">{customer.email}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">No email</span>
                                                        )}
                                                        {customer.phone && (
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                                <Phone className="w-3 h-3 text-gray-400" />
                                                                {customer.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(customer.totalPurchases)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${customer.status === 1
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : "bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700"
                                                        }`}>
                                                        {customer.status === 1 ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(customer.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    <div className="relative flex justify-end dropdown-trigger">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === customer._id ? null : customer._id); }}
                                                            className="p-2 text-gray-400 hover:text-primary-900 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        {activeDropdown === customer._id && (
                                                            <div className="absolute right-0 mt-10 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                                <PermissionGate resource="customers" action="edit">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            openModal(customer);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        <Edit className="w-4 h-4 text-primary-600 dark:text-primary-500" />
                                                                        Edit Details
                                                                    </button>
                                                                </PermissionGate>
                                                                <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                <PermissionGate resource="customers" action="delete">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(customer._id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Delete Customer
                                                                    </button>
                                                                </PermissionGate>
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

                        {/* Pagination */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Showing <span className="text-gray-900 dark:text-white">{customers.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> customers
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => page > 1 && setPage(page - 1)}
                                    disabled={page <= 1}
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
                                                onClick={() => setPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === pageNum
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
                                    onClick={() => page < pagination.pages && setPage(page + 1)}
                                    disabled={page >= pagination.pages}
                                    className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Customer Preview Panel ── */}
                    {/* Desktop: sticky side panel | Mobile: fixed bottom sheet (handled inside component) */}
                    {selectedCustomerId && (
                        <>
                            {/* Desktop wrapper */}
                            <div className="hidden lg:block shrink-0 overflow-scroll rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm" style={{ width: '380px', maxHeight: 'calc(100vh - 220px)', position: 'sticky', top: '24px', alignSelf: 'flex-start' }}>
                                <CustomerPreviewPanel
                                    customerId={selectedCustomerId}
                                    onClose={() => setSelectedCustomerId(null)}
                                />
                            </div>
                            {/* Mobile: rendered by CustomerPreviewPanel as fixed overlay */}
                            <div className="lg:hidden">
                                <CustomerPreviewPanel
                                    customerId={selectedCustomerId}
                                    onClose={() => setSelectedCustomerId(null)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Add/Edit Customer Modal ─── */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCustomer ? "Edit Customer" : "Add New Customer"}>
                <form onSubmit={handleSubmit}>
                    {formError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                            {formError}
                        </div>
                    )}
                    <FormInput
                        label="Customer Name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter customer name"
                    />
                    <FormInput
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="customer@example.com"
                    />
                    <FormInput
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter phone number"
                    />
                    <FormInput
                        label="Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Enter address"
                    />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Ngày sinh</label>
                            <input
                                type="date"
                                value={(formData as any).dateOfBirth || ""}
                                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value } as any)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 focus:border-transparent text-sm text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Số lần ghé thăm</label>
                            <input
                                type="number"
                                min={0}
                                value={(formData as any).visitCount ?? ""}
                                onChange={(e) => setFormData({ ...formData, visitCount: e.target.value === "" ? undefined : Number(e.target.value) } as any)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 focus:border-transparent text-sm text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="Additional notes"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900 focus:border-transparent text-sm resize-none text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormSelect
                            label="Giới tính"
                            value={(formData as any).gender}
                            onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
                            options={[
                                { value: "other", label: "Không xác định" },
                                { value: "female", label: "Nữ" },
                                { value: "male", label: "Nam" },
                            ]}
                        />
                        <FormSelect
                            label="Status"
                            required
                            value={formData.status}
                            onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                            options={[
                                { value: 1, label: "Active" },
                                { value: 0, label: "Inactive" }
                            ]}
                        />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <FormButton type="submit" loading={submitting}>
                            {editingCustomer ? "Update Customer" : "Create Customer"}
                        </FormButton>
                    </div>
                </form>
            </Modal>

            {/* ─── Import CSV Modal ─── */}
            <Modal isOpen={isImportOpen} onClose={closeImport} title="Import Customers from CSV">
                {/* Step Indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[
                        { num: 1, label: "Upload" },
                        { num: 2, label: "Preview" },
                        { num: 3, label: "Result" },
                    ].map((s, idx) => (
                        <div key={s.num} className="flex items-center gap-2 flex-1">
                            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${importStep >= s.num
                                ? "bg-primary-900 text-white"
                                : "bg-gray-100 dark:bg-slate-700 text-gray-400"
                                }`}>
                                {importStep > s.num ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : s.num}
                            </div>
                            <span className={`text-xs font-semibold ${importStep >= s.num ? "text-gray-800 dark:text-white" : "text-gray-400"}`}>
                                {s.label}
                            </span>
                            {idx < 2 && <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700 mx-1" />}
                        </div>
                    ))}
                </div>

                {/* ── Step 1: Upload ── */}
                {importStep === 1 && (
                    <div className="space-y-4">
                        {/* Template download */}
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div>
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Need a template?</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Download CSV template with correct column format</p>
                            </div>
                            <button
                                onClick={handleDownloadTemplate}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0"
                            >
                                Download Template
                            </button>
                        </div>

                        {/* Drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                            onDragLeave={() => setImportDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setImportDragOver(false);
                                const file = e.dataTransfer.files[0];
                                if (file) handleFileSelect(file);
                            }}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${importDragOver
                                ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20"
                                : "border-gray-300 dark:border-slate-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                                }`}
                            onClick={() => document.getElementById("import-file-input")?.click()}
                        >
                            <input
                                id="import-file-input"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelect(file);
                                }}
                            />
                            <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {importFile ? (
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{importFile.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB — Click to change</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Drag & drop your CSV file here</p>
                                    <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                                    <p className="text-xs text-gray-400 mt-2">Max 5,000 rows per import</p>
                                </div>
                            )}
                        </div>

                        {/* Required columns info */}
                        <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Required columns:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {["name (required)", "email", "phone (required)", "address", "notes", "status", "gender", "birthday", "visitCount", "totalSpent"].map((col) => (
                                    <span key={col} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${col.includes("required")
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                                        }`}>
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-2">
                            <button onClick={closeImport} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => importFile && setImportStep(2)}
                                disabled={!importFile}
                                className="px-5 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Preview →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Preview ── */}
                {importStep === 2 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Showing first <span className="font-semibold text-gray-900 dark:text-white">{importPreview.rows.length}</span> rows preview
                            </p>
                            <span className="text-xs font-semibold px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                {importFile?.name}
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold">#</th>
                                        {importPreview.headers.map((h, i) => (
                                            <th key={i} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {importPreview.rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            <td className="px-3 py-2 text-gray-400">{i + 2}</td>
                                            {row.map((cell, j) => (
                                                <td key={j} className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[150px] truncate" title={cell}>
                                                    {cell || <span className="text-gray-300 dark:text-gray-600 italic">—</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                            <strong>Lưu ý:</strong> Nếu phone hoặc email trùng với khách hàng hiện có, dữ liệu sẽ được <strong>cập nhật</strong> (upsert). Khách hàng mới sẽ được tạo mới.
                        </div>

                        <div className="flex justify-between gap-3 mt-2">
                            <button onClick={() => setImportStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                                ← Back
                            </button>
                            <button
                                onClick={handleImportSubmit}
                                disabled={importing}
                                className="px-5 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-60 flex items-center gap-2"
                            >
                                {importing && (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                )}
                                {importing ? "Importing..." : "Start Import"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Result ── */}
                {importStep === 3 && importResult && (
                    <div className="space-y-5">
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Total Rows", value: importResult.total, color: "bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white" },
                                { label: "New", value: importResult.imported, color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" },
                                { label: "Updated", value: importResult.updated, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400" },
                                { label: "Skipped", value: importResult.skipped, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400" },
                            ].map((stat) => (
                                <div key={stat.label} className={`rounded-xl p-3 text-center ${stat.color}`}>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="text-xs font-semibold mt-0.5 opacity-80">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Errors */}
                        {importResult.errors.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                                    Errors ({importResult.errors.length})
                                </p>
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 divide-y divide-red-100 dark:divide-red-800">
                                    {importResult.errors.map((err, i) => (
                                        <div key={i} className="px-3 py-2 text-xs text-red-700 dark:text-red-400">
                                            <span className="font-semibold">Row {err.row}:</span> {err.reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {importResult.errors.length === 0 && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Import completed with no errors!</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-2">
                            <button onClick={openImport} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                Import Another File
                            </button>
                            <button
                                onClick={closeImport}
                                className="px-5 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
