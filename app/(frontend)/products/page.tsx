
"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Package, AlertCircle, ChevronLeft, ChevronRight, MoreVertical, Filter, FileText } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatCurrency } from "@/lib/currency";

interface Product {
    _id: string;
    name: string;
    category: string;
    brand: string;
    price: number;
    costPrice: number;
    stock: number;
    type: string;
    status: string;
}

export default function ProductsPage() {
    const { settings } = useSettings();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

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
        category: "",
        brand: "",
        price: 0,
        costPrice: 0,
        stock: 0,
        type: "retail",
        alertQuantity: 5,
        status: "active"
    });

    useEffect(() => {
        fetchProducts();
    }, [page]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("page", page.toString());
            query.append("limit", "10");
            if (search) query.append("search", search);

            const res = await fetch(`/api/products?${query.toString()}`);
            const data = await res.json();
            if (data.success) {
                setProducts(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingProduct ? `/api/products/${editingProduct._id}` : "/api/products";
            const res = await fetch(url, {
                method: editingProduct ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                fetchProducts();
                closeModal();
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

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product?")) return;
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if ((await res.json()).success) fetchProducts();
    };

    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                category: product.category,
                brand: product.brand,
                price: product.price,
                costPrice: product.costPrice,
                stock: product.stock,
                type: product.type,
                alertQuantity: 5, // Default or fetch
                status: product.status
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: "", category: "", brand: "",
                price: 0, costPrice: 0, stock: 0,
                type: "retail", alertQuantity: 5, status: "active"
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your product stock, pricing and retail items</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <PermissionGate resource="products" action="create">
                                <button
                                    onClick={() => openModal()}
                                    className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Product
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
                                    placeholder="Search by product name..."
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

                        <div className="hidden md:block overflow-x-auto text-black dark:text-white">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                                <thead className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                                    {loading && products.length === 0 ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded"></div></td>
                                            </tr>
                                        ))
                                    ) : products.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No products found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        products.map((product) => (
                                            <tr key={product._id} className="hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                                            <Package className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{product.name}</span>
                                                            <div className="text-[10px] text-gray-400 font-medium uppercase">{product.brand || 'No Brand'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700">
                                                        {product.category || 'Uncategorized'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-sm font-bold ${product.stock <= 5 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                                                            {product.stock}
                                                        </span>
                                                        {product.stock <= 5 && <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(product.price, settings.currency)}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${product.type === 'retail' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-primary-50 text-primary-700 border-primary-200'}`}>
                                                        {product.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    <div className="relative flex justify-end dropdown-trigger">
                                                        <button
                                                            onClick={() => setActiveDropdown(activeDropdown === product._id ? null : product._id)}
                                                            className="p-2 text-gray-400 hover:text-primary-900 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        {activeDropdown === product._id && (
                                                            <div className="absolute right-0 mt-10 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                                <PermissionGate resource="products" action="edit">
                                                                    <button
                                                                        onClick={() => {
                                                                            openModal(product);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        <Edit className="w-4 h-4 text-primary-600 dark:text-primary-500" />
                                                                        Edit Details
                                                                    </button>
                                                                </PermissionGate>
                                                                <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                <PermissionGate resource="products" action="delete">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDelete(product._id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Delete Product
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

                        {/* Mobile Card List */}
                        <div className="md:hidden">
                            {loading && products.length === 0 ? (
                                <div className="p-3 space-y-2.5">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2"><div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded w-3/4" /><div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2" /></div>
                                                <div className="space-y-2"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" /><div className="h-5 bg-gray-100 dark:bg-slate-800 rounded-full w-16" /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : products.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-gray-400">
                                    <Package className="w-14 h-14 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No products found</p>
                                </div>
                            ) : (
                                <div className="p-3 space-y-2.5">
                                    {products.map((product) => {
                                        const isOpen = activeDropdown === product._id;
                                        const isLowStock = product.stock <= 5;
                                        const isRetail = product.type === 'retail';
                                        return (
                                            <div key={product._id} className="relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isLowStock ? 'bg-red-400' : 'bg-orange-400'}`} style={{ borderRadius: '4px 0 0 4px' }} />
                                                <div className="absolute right-1 top-1 z-20 dropdown-trigger">
                                                    <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(isOpen ? null : product._id); }} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {isOpen && (
                                                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                                                            <PermissionGate resource="products" action="edit">
                                                                <button onClick={() => { openModal(product); setActiveDropdown(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors">
                                                                    <Edit className="w-4 h-4 text-blue-500" /> Edit Product
                                                                </button>
                                                            </PermissionGate>
                                                            <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                            <PermissionGate resource="products" action="delete">
                                                                <button onClick={() => { handleDelete(product._id); setActiveDropdown(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                                    <Trash2 className="w-4 h-4" /> Delete
                                                                </button>
                                                            </PermissionGate>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-800 pl-3">
                                                    {/* Col 1: Name + Brand + Category */}
                                                    <div className="px-3 py-3 pr-6 flex flex-col gap-2 min-w-0">
                                                        <div className="flex items-start gap-2">
                                                            <div className="mt-0.5 p-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg shrink-0">
                                                                <Package className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{product.name}</div>
                                                                <div className="text-[10px] text-gray-400">{product.brand || 'No Brand'}</div>
                                                            </div>
                                                        </div>
                                                        <span className="self-start inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 truncate max-w-full">
                                                            {product.category || 'Uncategorized'}
                                                        </span>
                                                    </div>
                                                    {/* Col 2: Stock + Price + Type */}
                                                    <div className="px-3 py-3 flex flex-col gap-2 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            {isLowStock && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                            <span className={`text-[14px] font-black ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{product.stock} units</span>
                                                        </div>
                                                        <div className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{formatCurrency(product.price, settings.currency)}</div>
                                                        <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isRetail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-primary-50 text-primary-700 border-primary-200'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isRetail ? 'bg-emerald-400' : 'bg-primary-400'}`} />
                                                            {product.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Showing <span className="text-gray-900 dark:text-white">{products.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> products
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
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingProduct ? "Edit Product" : "Add Product"}>
                <form onSubmit={handleSubmit}>
                    <FormInput label="Product Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Category" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                        <FormInput label="Brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label={`Retail Price (${settings.symbol})`} type="number" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                        <FormInput label={`Cost Price (${settings.symbol})`} type="number" required value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Stock" type="number" required value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                        <FormSelect label="Type" value={formData.type} onChange={(e: any) => setFormData({ ...formData, type: e.target.value })} options={[{ value: "retail", label: "Retail Sale" }, { value: "internal", label: "Internal Use" }]} />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:hover:bg-slate-800">Cancel</button>
                        <FormButton type="submit" loading={submitting}>
                            {editingProduct ? "Update Product" : "Add Product"}
                        </FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
