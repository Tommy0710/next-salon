
"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Scissors, Tag, Clock, DollarSign, ChevronLeft, ChevronRight, MoreVertical, Filter, FileText } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatCurrency } from "@/lib/currency";

interface Category {
    _id: string;
    name: string;
    status: string;
}

interface Service {
    _id: string;
    name: string;
    category: Category;
    duration: number;
    price: number;
    gender: string;
    status: number;
    createdAt: string;
}

export default function ServicesPage() {
    const { settings } = useSettings();
    const [services, setServices] = useState<Service[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Service Modal State
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [serviceFormData, setServiceFormData] = useState({
        name: "",
        category: "",
        duration: 30,
        price: 0,
        gender: "unisex",
        status: 1,
        commissionType: "percentage",
        commissionValue: 0
    });

    // Category Modal State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryName, setCategoryName] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [categorySubmitting, setCategorySubmitting] = useState(false);

    // Filters & Pagination
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchServices();
    }, [selectedCategory, page]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchServices();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchCategories = async () => {
        const res = await fetch("/api/service-categories");
        const data = await res.json();
        if (data.success) setCategories(data.data);
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", page.toString());
            query.append("limit", "10");
            if (search) query.append("search", search);
            if (selectedCategory) query.append("category", selectedCategory);

            const res = await fetch(`/api/services?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setServices(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleServiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingService ? `/api/services/${editingService._id}` : "/api/services";
            const res = await fetch(url, {
                method: editingService ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(serviceFormData),
            });
            const data = await res.json();
            if (data.success) {
                fetchServices();
                closeServiceModal();
            } else {
                alert(data.error || "Something went wrong");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCategorySubmitting(true);
        try {
            const res = await fetch("/api/service-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: categoryName, slug: categoryName.toLowerCase().replace(/\s+/g, '-') }),
            });
            const data = await res.json();
            if (data.success) {
                fetchCategories();
                setCategoryName("");
                setIsCategoryModalOpen(false);
            } else {
                alert(data.error || "Failed to create category");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred");
        } finally {
            setCategorySubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this service?")) return;
        const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
        if ((await res.json()).success) fetchServices();
    };

    const openServiceModal = (service?: Service) => {
        if (service) {
            setEditingService(service);
            setServiceFormData({
                name: service.name,
                category: service.category._id,
                duration: service.duration,
                price: service.price,
                gender: service.gender,
                status: service.status,
                commissionType: "percentage",
                commissionValue: 0 // Fetch full details if needed
            });
        } else {
            setEditingService(null);
            setServiceFormData({
                name: "",
                category: categories[0]?._id || "",
                duration: 30,
                price: 0,
                gender: "unisex",
                status: 1,
                commissionType: "percentage",
                commissionValue: 0
            });
        }
        setIsServiceModalOpen(true);
    };

    const closeServiceModal = () => {
        setIsServiceModalOpen(false);
        setEditingService(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Services</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your salon service catalog and categories</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <PermissionGate resource="services" action="create">
                            <button
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Tag className="w-4 h-4" />
                                New Category
                            </button>
                            <button
                                onClick={() => openServiceModal()}
                                className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                New Service
                            </button>
                        </PermissionGate>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white">
                    {/* Filters Bar */}
                    <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950/50">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by service name..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                                <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <select
                                    className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none"
                                    value={selectedCategory}
                                    onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => { setSearch(""); setSelectedCategory(""); setPage(1); }}
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gender</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                                {loading && services.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                        </tr>
                                    ))
                                ) : services.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                            <Scissors className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No services found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    services.map((service) => (
                                        <tr key={service._id} className="hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                                        <Scissors className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{service.name}</span>
                                                        <div className="text-[10px] text-gray-400 font-medium uppercase">Internal ID: {service._id.slice(-6)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700">
                                                    {service.category?.name || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                    {service.duration} min
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(service.price, settings.currency)}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs text-gray-600 dark:text-gray-400 capitalize font-medium">{service.gender}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${service.status === 1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`}>
                                                    {service.status === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <div className="relative flex justify-end dropdown-trigger">
                                                    <button
                                                        onClick={() => setActiveDropdown(activeDropdown === service._id ? null : service._id)}
                                                        className="p-2 text-gray-400 hover:text-primary-900 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {activeDropdown === service._id && (
                                                        <div className="absolute right-0 mt-10 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                            <PermissionGate resource="services" action="edit">
                                                                <button
                                                                    onClick={() => {
                                                                        openServiceModal(service);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                >
                                                                    <Edit className="w-4 h-4 text-primary-600 dark:text-primary-500" />
                                                                    Edit Details
                                                                </button>
                                                            </PermissionGate>
                                                            <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                            <PermissionGate resource="services" action="delete">
                                                                <button
                                                                    onClick={() => {
                                                                        handleDelete(service._id);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Delete Service
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
                            Showing <span className="text-gray-900 dark:text-white">{services.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> services
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
            </div>

            {/* Service Modal */}
            <Modal isOpen={isServiceModalOpen} onClose={closeServiceModal} title={editingService ? "Edit Service" : "Add New Service"}>
                <form onSubmit={handleServiceSubmit}>
                    <FormInput
                        label="Service Name"
                        required
                        value={serviceFormData.name}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                        placeholder="e.g. Hair Cut"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Category"
                            required
                            value={serviceFormData.category}
                            onChange={(val) => setServiceFormData({ ...serviceFormData, category: val })}
                            placeholder="Select Category"
                            options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                        />
                        <FormInput
                            label={`Price (${settings.symbol})`}
                            type="number"
                            required
                            value={serviceFormData.price}
                            onChange={(e) => setServiceFormData({ ...serviceFormData, price: parseFloat(e.target.value) })}
                            min="0"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Duration (min)"
                            type="number"
                            required
                            value={serviceFormData.duration}
                            onChange={(e) => setServiceFormData({ ...serviceFormData, duration: parseInt(e.target.value) })}
                            min="0"
                        />
                        <FormSelect
                            label="Gender"
                            value={serviceFormData.gender}
                            onChange={(e: any) => setServiceFormData({ ...serviceFormData, gender: e.target.value })}
                            options={[
                                { value: "unisex", label: "Unisex" },
                                { value: "female", label: "Female" },
                                { value: "male", label: "Male" }
                            ]}
                        />
                    </div>

                    <FormSelect
                        label="Status"
                        value={serviceFormData.status}
                        onChange={(e: any) => setServiceFormData({ ...serviceFormData, status: e.target.value })}
                        options={[
                            { value: 1, label: "Active" },
                            { value: 0, label: "Inactive" }
                        ]}
                    />

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={closeServiceModal}
                            className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <FormButton
                            type="submit"
                            loading={submitting}
                        >
                            {editingService ? "Update Service" : "Create Service"}
                        </FormButton>
                    </div>
                </form>
            </Modal>

            {/* Category Modal */}
            <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Add New Category">
                <form onSubmit={handleCategorySubmit}>
                    <FormInput
                        label="Category Name"
                        required
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="e.g. Hair Treatment"
                    />
                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsCategoryModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <FormButton
                            type="submit"
                            loading={categorySubmitting}
                        >
                            Create Category
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
