
"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit, Trash2, Search, Package, AlertCircle, ChevronLeft, ChevronRight, Filter, Tag } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import PermissionGate from "@/components/PermissionGate";
import ActionDropdown from "@/components/dashboard/ActionDropdown";
import { MobileCardList, MobileCard } from "@/components/dashboard/MobileCardList";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatCurrency } from "@/lib/currency";

interface Category {
    _id: string;
    name: string;
}

interface Brand {
    _id: string;
    name: string;
}

interface Product {
    _id: string;
    name: string;
    category: Category;
    brand?: Brand;
    image?: string;
    price: number;
    costPrice: number;
    stock: number;
    alertQuantity: number;
    type: string;
    status: string;
}

export default function ProductsPage() {
    const { settings } = useSettings();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryName, setCategoryName] = useState("");
    const [categorySubmitting, setCategorySubmitting] = useState(false);
    const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
    const [brandName, setBrandName] = useState("");
    const [brandSubmitting, setBrandSubmitting] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });

    const [formData, setFormData] = useState({
        name: "", category: "", brand: "", image: "",
        price: 0, costPrice: 0, stock: 0, type: "retail", productType: "PRODUCT", alertQuantity: 5, status: "active"
    });

    useEffect(() => { fetchCategories(); fetchBrands(); }, []);
    useEffect(() => { fetchProducts(); }, [selectedCategory, selectedBrand, page]);
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); fetchProducts(); }, 500);
        return () => clearTimeout(t);
    }, [search]);

    const fetchCategories = async () => {
        const res = await fetch("/api/product-categories");
        const data = await res.json();
        if (data.success) setCategories(data.data);
    };

    const fetchBrands = async () => {
        const res = await fetch("/api/product-brands");
        const data = await res.json();
        if (data.success) setBrands(data.data);
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ page: page.toString(), limit: "10" });
            if (search) q.append("search", search);
            if (selectedCategory) q.append("category", selectedCategory);
            if (selectedBrand) q.append("brand", selectedBrand);
            const res = await fetch(`/api/products?${q}`);
            const data = await res.json();
            if (data.success) { setProducts(data.data); if (data.pagination) setPagination(data.pagination); }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingProduct ? `/api/products/${editingProduct._id}` : "/api/products";
            const res = await fetch(url, { method: editingProduct ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
            const data = await res.json();
            if (data.success) { fetchProducts(); closeModal(); toast.success(editingProduct ? "Product updated!" : "Product added!"); }
            else toast.error(data.error || "Something went wrong");
        } catch { toast.error("An error occurred"); }
        finally { setSubmitting(false); }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCategorySubmitting(true);
        try {
            const res = await fetch("/api/product-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: categoryName }) });
            const data = await res.json();
            if (data.success) { fetchCategories(); setCategoryName(""); setIsCategoryModalOpen(false); toast.success("Category created!"); }
            else toast.error(data.error || "Failed to create category");
        } catch { toast.error("An error occurred"); }
        finally { setCategorySubmitting(false); }
    };

    const handleBrandSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBrandSubmitting(true);
        try {
            const res = await fetch("/api/product-brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: brandName }) });
            const data = await res.json();
            if (data.success) { fetchBrands(); setBrandName(""); setIsBrandModalOpen(false); toast.success("Brand created!"); }
            else toast.error(data.error || "Failed to create brand");
        } catch { toast.error("An error occurred"); }
        finally { setBrandSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product?")) return;
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if ((await res.json()).success) fetchProducts();
    };

    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({ name: product.name, category: product.category?._id || "", brand: product.brand?._id || "", image: product.image || "", price: product.price, costPrice: product.costPrice, stock: product.stock, type: product.type, productType: (product as any).productType || "PRODUCT", alertQuantity: product.alertQuantity ?? 5, status: product.status });
        } else {
            setEditingProduct(null);
            setFormData({ name: "", category: categories[0]?._id || "", brand: "", image: "", price: 0, costPrice: 0, stock: 0, type: "retail", productType: "PRODUCT", alertQuantity: 5, status: "active" });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingProduct(null); };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your product stock, pricing and retail items</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <PermissionGate resource="products" action="create">
                            <button onClick={() => setIsBrandModalOpen(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm">
                                <Tag className="w-4 h-4 text-blue-500" /> New Brand
                            </button>
                            <button onClick={() => setIsCategoryModalOpen(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm">
                                <Tag className="w-4 h-4" /> New Category
                            </button>
                            <button onClick={() => openModal()} className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm">
                                <Plus className="w-4 h-4" /> Add Product
                            </button>
                        </PermissionGate>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-950/50">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input type="text" placeholder="Search by product name..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}>
                                    <option value="">All Categories</option>
                                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none" value={selectedBrand} onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}>
                                    <option value="">All Brands</option>
                                    {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                                </select>
                            </div>
                            <button onClick={() => { setSearch(""); setSelectedCategory(""); setSelectedBrand(""); setPage(1); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm px-2">Reset</button>
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                            <thead className="bg-gray-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brand</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">POS</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                                {loading && products.length === 0 ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse"><td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded" /></td></tr>
                                )) : products.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500"><Package className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No products found</p></td></tr>
                                ) : products.map((product) => (
                                    <tr key={product._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg shrink-0"><Package className="w-4 h-4 text-orange-600 dark:text-orange-500" /></div>
                                                )}
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700">{product.category?.name || 'Uncategorized'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {product.brand?.name || <span className="text-gray-300 dark:text-slate-600">—</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm font-bold ${product.stock <= (product.alertQuantity ?? 5) ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{product.stock}</span>
                                                {product.stock <= (product.alertQuantity ?? 5) && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(product.price, settings.currency)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${product.type === 'retail' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-primary-50 text-primary-700 border-primary-200'}`}>{product.type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(product as any).productType === 'PRE_AMOUNT' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/40">
                                                    Nạp ví
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/40">
                                                    Sản phẩm
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="relative flex justify-end">
                                                <ActionDropdown items={[
                                                    { label: "Edit Details", icon: <Edit className="w-4 h-4" />, onClick: () => openModal(product), variant: "default" },
                                                    { label: "Delete Product", icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(product._id), variant: "danger", dividerBefore: true },
                                                ]} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <MobileCardList
                        items={products}
                        loading={loading}
                        emptyIcon={<Package className="w-14 h-14" />}
                        emptyText="No products found"
                        renderItem={(product) => {
                            const isLowStock = product.stock <= (product.alertQuantity ?? 5);
                            return (
                                <MobileCard key={product._id} accentColor={isLowStock ? 'bg-red-400' : 'bg-orange-400'}>
                                    <ActionDropdown className="absolute right-1 top-1 z-1" items={[
                                        { label: "Edit Product", icon: <Edit className="w-4 h-4" />, onClick: () => openModal(product), variant: "default" },
                                        { label: "Delete", icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(product._id), variant: "danger", dividerBefore: true },
                                    ]} />
                                    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-800 pl-3">
                                        <div className="px-3 py-3 pr-6 flex flex-col gap-2 min-w-0">
                                            <div className="flex items-start gap-2">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-9 h-9 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className="mt-0.5 p-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg shrink-0"><Package className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" /></div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{product.name}</div>
                                                    <div className="text-[10px] text-gray-400">{product.brand?.name || 'No Brand'}</div>
                                                </div>
                                            </div>
                                            <span className="self-start inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 truncate max-w-full">{product.category?.name || 'Uncategorized'}</span>
                                        </div>
                                        <div className="px-3 py-3 flex flex-col gap-2 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                {isLowStock && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                <span className={`text-[14px] font-black ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{product.stock} units</span>
                                            </div>
                                            <div className="text-[13px] font-bold text-gray-700 dark:text-gray-200">{formatCurrency(product.price, settings.currency)}</div>
                                            <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${product.type === 'retail' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-primary-50 text-primary-700 border-primary-200'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${product.type === 'retail' ? 'bg-emerald-400' : 'bg-primary-400'}`} />
                                                {product.type}
                                            </span>
                                            {(product as any).productType === 'PRE_AMOUNT' && (
                                                <span className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/40">
                                                    Nạp ví
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </MobileCard>
                            );
                        }}
                    />

                    <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Showing <span className="text-gray-900 dark:text-white">{products.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> products
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => page > 1 && setPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    const p = pagination.pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pagination.pages - 2 ? pagination.pages - 4 + i : page - 2 + i;
                                    return <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === p ? "bg-primary-900 dark:bg-primary-700 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"}`}>{p}</button>;
                                })}
                            </div>
                            <button onClick={() => page < pagination.pages && setPage(page + 1)} disabled={page >= pagination.pages} className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingProduct ? "Edit Product" : "Add Product"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-1">Image URL</label>
                        <input type="text" className="w-full p-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white rounded-lg outline-none focus:border-primary-500 text-sm" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} placeholder="https://example.com/image.jpg" />
                        {formData.image && <img src={formData.image} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm" />}
                    </div> */}
                    <FormInput label="Product Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-1">Category <span className="text-red-500">*</span></label>
                            <SearchableSelect value={formData.category} onChange={(val) => setFormData({ ...formData, category: val })} options={categories.map(c => ({ value: c._id, label: c.name }))} placeholder="Select category" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mb-1">Brand</label>
                            <SearchableSelect value={formData.brand} onChange={(val) => setFormData({ ...formData, brand: val })} options={[{ value: "", label: "No Brand" }, ...brands.map(b => ({ value: b._id, label: b.name }))]} placeholder="Select brand" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label={`Retail Price (${settings.symbol})`} type="number" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                        <FormInput label={`Cost Price (${settings.symbol})`} type="number" required value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Stock" type="number" required value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                        <FormSelect label="Type" value={formData.type} onChange={(e: any) => setFormData({ ...formData, type: e.target.value })} options={[{ value: "retail", label: "Retail Sale" }, { value: "internal", label: "Internal Use" }]} />
                        <FormSelect label="POS Behavior" value={formData.productType} onChange={(e: any) => setFormData({ ...formData, productType: e.target.value })} options={[{ value: "PRODUCT", label: "Normal Product" }, { value: "PRE_AMOUNT", label: "Wallet Top-up (Nạp ví)" }]} />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm">Cancel</button>
                        <FormButton type="submit" loading={submitting}>{editingProduct ? "Update Product" : "Add Product"}</FormButton>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="New Product Category">
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <FormInput label="Category Name" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Hair Care" />
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm">Cancel</button>
                        <FormButton type="submit" loading={categorySubmitting}>Create Category</FormButton>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isBrandModalOpen} onClose={() => setIsBrandModalOpen(false)} title="New Product Brand">
                <form onSubmit={handleBrandSubmit} className="space-y-4">
                    <FormInput label="Brand Name" required value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. L'Oréal" />
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setIsBrandModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm">Cancel</button>
                        <FormButton type="submit" loading={brandSubmitting}>Create Brand</FormButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
