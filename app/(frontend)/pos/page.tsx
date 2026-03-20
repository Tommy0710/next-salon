
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Scissors as ScissorsIcon, Package, LayoutDashboard } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { useSettings } from "@/components/providers/SettingsProvider";

interface Item {
    _id: string;
    name: string;
    price: number;
    type: 'Service' | 'Product';
    duration?: number; // Service only
    stock?: number; // Product only
    commissionType?: 'percentage' | 'fixed';
    commissionValue?: number;
}

interface Staff {
    _id: string;
    name: string;
    commissionRate: number;
}

interface CartItem extends Item {
    quantity: number;
}

interface Customer {
    _id: string;
    name: string;
    phone?: string;
}

interface StaffAssignment {
    staffId: string;
    percentage: number;
}

export default function POSPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
    const [services, setServices] = useState<Item[]>([]);
    const [products, setProducts] = useState<Item[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [serviceStaffAssignments, setServiceStaffAssignments] = useState<Record<string, StaffAssignment[]>>({});
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [amountPaid, setAmountPaid] = useState<number | string>("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        setLoading(true);
        try {
            const [serviceRes, productRes, customerRes, staffRes] = await Promise.all([
                fetch("/api/services?limit=1000"),
                fetch("/api/products?limit=1000"),
                fetch("/api/customers?limit=1000"),
                fetch("/api/staff?limit=1000")
            ]);

            const sData = await serviceRes.json();
            const pData = await productRes.json();
            const cData = await customerRes.json();
            const stData = await staffRes.json();

            if (sData.success) {
                setServices(sData.data.map((s: any) => ({ ...s, type: 'Service' })));
            }
            if (pData.success) {
                setProducts(pData.data.map((p: any) => ({ ...p, type: 'Product' })));
            }
            if (cData.success) {
                setCustomers(cData.data);
            }
            if (stData.success) {
                setStaffList(stData.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };



    const filteredItems = (activeTab === 'services' ? services : products).filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    const getCartItemKey = (itemId: string, type: string) => `${type}:${itemId}`;

    const addToCart = (item: Item) => {
        setCart(prev => {
            const existing = prev.find(i => i._id === item._id && i.type === item.type);
            if (existing) {
                return prev.map(i => i._id === item._id && i.type === item.type ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
        if (item.type === 'Service') {
            const key = getCartItemKey(item._id, item.type);
            setServiceStaffAssignments(prev => prev[key] ? prev : { ...prev, [key]: [] });
        }
    };

    const removeFromCart = (itemId: string, type: string) => {
        setCart(prev => prev.filter(i => !(i._id === itemId && i.type === type)));
        if (type === 'Service') {
            const key = getCartItemKey(itemId, type);
            setServiceStaffAssignments(prev => {
                const { [key]: _ignored, ...rest } = prev;
                return rest;
            });
        }
    };

    const updateQuantity = (itemId: string, type: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i._id === itemId && i.type === type) {
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const addServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        const key = getCartItemKey(itemId, type);
        const current = serviceStaffAssignments[key] || [];
        if (current.find(a => a.staffId === staffId)) return;
        const staff = staffList.find(s => s._id === staffId);
        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: [
                ...(prev[key] || []),
                {
                    staffId,
                    percentage: staff?.commissionRate || 0
                }
            ]
        }));
    };

    const removeServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        const key = getCartItemKey(itemId, type);
        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: (prev[key] || []).filter(a => a.staffId !== staffId)
        }));
    };

    const updateServiceStaffPercentage = (itemId: string, type: string, staffId: string, percentage: number) => {
        const key = getCartItemKey(itemId, type);
        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: (prev[key] || []).map(a =>
                a.staffId === staffId ? { ...a, percentage } : a
            )
        }));
    };

    const calculateTotal = () => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (settings.taxRate / 100);
        const total = subtotal + tax - discount;

        // Commission calculation aggregated per staff from per-service assignments
        let totalCommission = 0;
        const perStaff: Record<string, { staffId: string; commission: number }> = {};

        const serviceNetBase = cart.reduce((sum, item) => {
            if (item.type !== 'Service') return sum;
            const itemTotal = item.price * item.quantity;
            const serviceNet = subtotal > 0 ? (total * (itemTotal / subtotal)) : 0;
            return sum + serviceNet;
        }, 0);

        cart.forEach(item => {
            if (item.type !== 'Service') return;
            const key = getCartItemKey(item._id, item.type);
            const itemTotal = item.price * item.quantity;
            const serviceNet = subtotal > 0 ? (total * (itemTotal / subtotal)) : 0;
            const serviceAssignments = serviceStaffAssignments[key] || [];

            serviceAssignments.forEach(assignment => {
                const percentage = Number(assignment.percentage) || 0;
                if (percentage <= 0) return;
                const staffComm = (serviceNet * percentage) / 100;
                totalCommission += staffComm;

                if (!perStaff[assignment.staffId]) {
                    perStaff[assignment.staffId] = { staffId: assignment.staffId, commission: 0 };
                }
                perStaff[assignment.staffId].commission += staffComm;
            });
        });

        const updatedAssignments = Object.values(perStaff).map(assignment => ({
            staffId: assignment.staffId,
            percentage: serviceNetBase > 0 ? (assignment.commission / serviceNetBase) * 100 : 0,
            commission: assignment.commission
        }));

        return { subtotal, tax, total, commission: totalCommission, assignments: updatedAssignments };
    };

    const handleCheckout = async () => {
        if (!selectedCustomer) {
            alert("Please select a customer");
            return;
        }
        if (cart.length === 0) {
            alert("Cart is empty");
            return;
        }
        const serviceItems = cart.filter(item => item.type === 'Service');
        for (const item of serviceItems) {
            const key = getCartItemKey(item._id, item.type);
            const itemAssignments = serviceStaffAssignments[key] || [];
            const percentTotal = itemAssignments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
            if (percentTotal > 100) {
                alert(`Staff percentage for service "${item.name}" cannot exceed 100%`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const { subtotal, tax, total, commission, assignments } = calculateTotal();

            const paid = amountPaid === "" ? total : parseFloat(amountPaid.toString());
            const status = paid >= total ? "paid" : "partially_paid";

            // Handle walking customer by setting customer to undefined
            const customerId = selectedCustomer === 'walking-customer' ? undefined : selectedCustomer;

            const payload = {
                customer: customerId,
                items: cart.map(item => ({
                    item: item._id,
                    itemModel: item.type,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity
                })),
                subtotal,
                tax,
                discount,
                totalAmount: total,
                commission,
                staffAssignments: assignments.map(a => ({
                    staff: a.staffId,
                    percentage: a.percentage,
                    commission: a.commission
                })),
                staff: assignments[0]?.staffId || undefined, // Keep primary staff for compatibility
                amountPaid: 0,
                paymentMethod,
                status: status
            };

            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                // If there's a payment, create a deposit record
                if (paid > 0) {
                    await fetch("/api/deposits", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            invoice: data.data._id,
                            customer: customerId,
                            amount: paid,
                            paymentMethod,
                            notes: "Initial payment from POS"
                        }),
                    });
                }

                setCart([]);
                setDiscount(0);
                setSelectedCustomer("");
                setServiceStaffAssignments({});
                setAmountPaid("");
                router.push(`/invoices/print/${data.data._id}`);
            } else {
                alert(data.error || "Failed to create invoice");
            }
        } catch (error) {
            console.error(error);
            alert("Error processing checkout");
        } finally {
            setSubmitting(false);
        }
    };

    const { subtotal, tax, total, commission, assignments } = calculateTotal();
    const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

    return (
        <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden flex-col md:flex-row">
            {/* Left Side: Items Catalog */}
            <div className={`flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-white flex flex-col h-full overflow-hidden">
                    {/* Header/Tabs */}
                    <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h1 className="text-lg md:text-xl font-bold text-gray-800">POS System</h1>
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                                <button
                                    onClick={() => router.push("/dashboard")}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    <span className="hidden xs:inline">Dashboard</span>
                                </button>
                                <div className="relative flex-1 sm:w-64 min-w-[150px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('services')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Services
                            </button>
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Products
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-50 pb-20 md:pb-4">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent"></div></div>
                        ) : (
                            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
                                {filteredItems.map(item => (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        className="bg-white p-2 md:p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center text-center group min-h-[120px] md:min-h-[132px] active:scale-95 duration-75"
                                    >
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                            {item.type === 'Service' ? (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-purple-100 flex items-center justify-center">
                                                    <ScissorsIcon className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-100 flex items-center justify-center">
                                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-[10px] md:text-xs leading-tight line-clamp-2 mb-1 h-8 flex items-center justify-center">{item.name}</h3>
                                        <p className="text-blue-900 font-bold text-xs md:text-sm">{settings.symbol}{item.price}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side: Cart */}
            <div className={`w-full md:w-80 lg:w-96 flex-1 md:flex-none flex flex-col bg-white border-l border-gray-200 ${mobileTab === 'catalog' ? 'hidden md:flex' : 'flex'} h-full`}>
                <div className="bg-white flex flex-col h-full overflow-hidden">
                    <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                            <SearchableSelect
                                placeholder="Select Customer"
                                value={selectedCustomer}
                                onChange={(val) => setSelectedCustomer(val)}
                                options={[{ value: 'walking-customer', label: 'Walking Customer' }, ...customers.map(c => ({ value: c._id, label: `${c.name} ${c.phone ? `(${c.phone})` : ''}` }))]}
                                className="flex-1"
                            />
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-2 pb-24 md:pb-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                                <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
                                <p className="text-xs md:text-sm">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item._id} className="p-2 border border-gray-100 rounded-lg bg-white shadow-sm space-y-2">
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <div className="flex-shrink-0">
                                                {item.type === 'Service' ? (
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                                                        <ScissorsIcon className="w-3 h-3 text-purple-600" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                                        <Package className="w-3 h-3 text-green-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] md:text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                                                <p className="text-[9px] md:text-[10px] text-gray-500">{settings.symbol}{item.price}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={() => updateQuantity(item._id, item.type, -1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Minus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                            <span className="text-[10px] md:text-xs font-bold w-4 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item._id, item.type, 1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                            <button onClick={() => removeFromCart(item._id, item.type)} className="p-1 hover:bg-red-50 text-red-500 rounded ml-0.5"><Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                        </div>
                                    </div>
                                    {item.type === 'Service' && (
                                        <div className="pl-8 space-y-1.5">
                                            <SearchableSelect
                                                placeholder="Assign staff"
                                                value=""
                                                onChange={(val) => addServiceStaffAssignment(item._id, item.type, val)}
                                                options={staffList.map(s => ({ value: s._id, label: s.name }))}
                                                className="w-full h-8"
                                            />
                                            {(serviceStaffAssignments[getCartItemKey(item._id, item.type)] || []).length > 0 && (
                                                <div className="space-y-1">
                                                    {(serviceStaffAssignments[getCartItemKey(item._id, item.type)] || []).map(assignment => {
                                                        const staff = staffList.find(s => s._id === assignment.staffId);
                                                        return (
                                                            <div key={assignment.staffId} className="flex items-center gap-1.5 bg-blue-50 p-1 rounded border border-blue-100">
                                                                <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">{staff?.name}</p>
                                                                <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-blue-200">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={assignment.percentage}
                                                                        onChange={(e) => updateServiceStaffPercentage(item._id, item.type, assignment.staffId, parseFloat(e.target.value) || 0)}
                                                                        className="w-6 text-right text-[9px] font-black focus:outline-none"
                                                                    />
                                                                    <span className="text-[9px] font-bold text-blue-900">%</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeServiceStaffAssignment(item._id, item.type, assignment.staffId)}
                                                                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Summary - Sticky at bottom */}
                    <div className="flex-shrink-0 p-3 bg-gray-50 border-t border-gray-200 overflow-y-auto md:max-h-[45%] pb-20 md:pb-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="space-y-1 mb-3 text-[10px] md:text-xs">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>{settings.symbol}{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Tax ({settings.taxRate}%)</span>
                                <span>{settings.symbol}{tax.toFixed(2)}</span>
                            </div>
                            {commission > 0 && (
                                <div className="space-y-1 bg-indigo-50 px-2 py-1.5 rounded border border-indigo-100/50">
                                    <div className="flex justify-between text-indigo-600 font-bold mb-1 border-b border-indigo-200/50 pb-0.5">
                                        <span>Total Commission</span>
                                        <span>{settings.symbol}{commission.toFixed(2)}</span>
                                    </div>
                                    {assignments.map((assignment, idx) => {
                                        const staff = staffList.find(s => s._id === assignment.staffId);
                                        return (
                                            <div key={idx} className="flex justify-between text-[9px] text-indigo-500 font-medium pl-1">
                                                <span className="truncate pr-2">{staff?.name}</span>
                                                <span className="flex-shrink-0">{settings.symbol}{(assignment.commission || 0).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600 items-center">
                                <span>Discount</span>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right text-[10px] md:text-xs border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-900 outline-none"
                                    min="0"
                                />
                            </div>
                            <div className="flex justify-between items-center text-blue-900 border-t border-gray-200 pt-1.5 mt-1">
                                <span className="text-[10px] font-bold">Paid</span>
                                <input
                                    type="number"
                                    placeholder={total.toFixed(2)}
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    className="w-20 text-right text-[10px] md:text-xs border-2 border-blue-900/20 rounded px-1 py-0.5 focus:border-blue-900 outline-none font-bold"
                                />
                            </div>
                            <div className="flex justify-between text-sm md:text-base font-black text-gray-900 pt-1 border-t border-gray-200">
                                <span> {parseFloat(amountPaid.toString()) < total ? 'Due' : 'Total'}</span>
                                <span className={parseFloat(amountPaid.toString()) < total ? 'text-red-600' : 'text-blue-900'}>
                                    {settings.symbol}{(parseFloat(amountPaid.toString()) < total ? (total - (parseFloat(amountPaid.toString()) || 0)) : total).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="mb-3">
                            <div className="grid grid-cols-3 gap-1 md:gap-1.5">
                                {['Cash', 'Card', 'Wallet'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-1.5 text-[9px] md:text-[10px] uppercase tracking-wider font-bold rounded border transition-all ${paymentMethod === method ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <FormButton
                            onClick={handleCheckout}
                            loading={submitting}
                            variant="success"
                            className="w-full py-4 md:py-4 text-xs md:text-sm uppercase tracking-widest font-black shadow-lg hover:shadow-xl active:translate-y-0.5 transition-all mb-4"
                            icon={<CreditCard className="w-4 h-4" />}
                        >
                            Complete Order
                        </FormButton>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around h-16 z-50 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setMobileTab('catalog')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all ${mobileTab === 'catalog' ? 'text-blue-900 scale-110' : 'text-gray-400'}`}
                >
                    <LayoutDashboard className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Catalog</span>
                    {mobileTab === 'catalog' && <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>}
                </button>
                <div className="w-px h-8 bg-gray-100"></div>
                <button
                    onClick={() => setMobileTab('cart')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all relative ${mobileTab === 'cart' ? 'text-blue-900 scale-110' : 'text-gray-400'}`}
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5 mb-1" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                {cart.reduce((a, b) => a + b.quantity, 0)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold">Cart</span>
                    {mobileTab === 'cart' && <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>}
                </button>
            </div>
        </div>
    );
}
