
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
// Add these to your existing interfaces
interface Bill {
    id: string;
    name: string;
    cart: CartItem[];
    selectedCustomer: string;
    serviceStaffAssignments: Record<string, StaffAssignment[]>;
    discount: number;
    paymentMethod: string;
    amountPaid: number | string;
}

const createEmptyBill = (): Bill => {
    const id = Date.now().toString();
    return {
        id,
        name: `Bill #${id.slice(-4)}`,
        cart: [],
        selectedCustomer: "",
        serviceStaffAssignments: {},
        discount: 0,
        paymentMethod: "Cash",
        amountPaid: ""
    };
};
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

    // --- NEW MULTI-BILL STATE ---
    const [isMounted, setIsMounted] = useState(false);
    const [bills, setBills] = useState<Bill[]>([]);
    const [activeBillId, setActiveBillId] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    // THÊM DÒNG NÀY: State để lưu ID của bill đang chuẩn bị xóa (mở modal)
    const [billToDelete, setBillToDelete] = useState<string | null>(null);

    // Load bills from localStorage on mount
    useEffect(() => {
        setIsMounted(true);
        const savedBills = localStorage.getItem("pos_waiting_bills");
        const savedActiveId = localStorage.getItem("pos_active_bill_id");

        if (savedBills) {
            const parsedBills = JSON.parse(savedBills);
            if (parsedBills.length > 0) {
                setBills(parsedBills);
                setActiveBillId(savedActiveId || parsedBills[0].id);
                return;
            }
        }

        // Default: Create 1 empty bill
        const initialBill = createEmptyBill();
        setBills([initialBill]);
        setActiveBillId(initialBill.id);
    }, []);

    // Save bills to localStorage whenever they change
    useEffect(() => {
        if (isMounted && bills.length > 0) {
            localStorage.setItem("pos_waiting_bills", JSON.stringify(bills));
            localStorage.setItem("pos_active_bill_id", activeBillId);
        }
    }, [bills, activeBillId, isMounted]);

    // Derived active bill for easy access
    const activeBill = bills.find(b => b.id === activeBillId) || bills[0];

    // Helper to safely update ONLY the active bill
    const updateActiveBill = (updates: Partial<Bill> | ((prev: Bill) => Partial<Bill>)) => {
        setBills(prevBills => prevBills.map(bill => {
            if (bill.id === activeBillId) {
                const newValues = typeof updates === "function" ? updates(bill) : updates;
                return { ...bill, ...newValues };
            }
            return bill;
        }));
    }
    // --- BILL MANAGEMENT ACTIONS ---
    const addNewBill = () => {
        const newBill = createEmptyBill();
        setBills(prev => [...prev, newBill]);
        setActiveBillId(newBill.id);
    };

    const switchBill = (id: string) => setActiveBillId(id);
    // 1. Hàm này chỉ mở popup xác nhận lên
    const handleRemoveClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Ngăn chặn việc click vào tab làm đổi tab
        setBillToDelete(id); // Gọi popup lên
    };

    // 2. Hàm này mới thực sự xóa bill khi bấm "Đồng ý"
    const confirmRemoveBill = () => {
        if (!billToDelete) return;

        setBills(prev => {
            const filtered = prev.filter(b => b.id !== billToDelete);
            // Nếu xóa trúng bill đang mở, tự động lùi về bill cuối cùng
            if (billToDelete === activeBillId) {
                setActiveBillId(filtered.length > 0 ? filtered[filtered.length - 1].id : "");
            }
            // Nếu xóa sạch không còn bill nào, tạo 1 bill mới tinh
            if (filtered.length === 0) {
                const fresh = createEmptyBill();
                setActiveBillId(fresh.id);
                return [fresh];
            }
            return filtered;
        });
        
        // Đóng popup sau khi xóa xong
        setBillToDelete(null); 
    };

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

    // --- CART ACTIONS (Refactored) ---
    const addToCart = (item: Item) => {
        if (!activeBill) return;
        updateActiveBill((bill) => {
            const existing = bill.cart.find(i => i._id === item._id && i.type === item.type);
            const newCart = existing
                ? bill.cart.map(i => i._id === item._id && i.type === item.type ? { ...i, quantity: i.quantity + 1 } : i)
                : [...bill.cart, { ...item, quantity: 1 }];

            const newAssignments = { ...bill.serviceStaffAssignments };
            if (item.type === 'Service') {
                const key = getCartItemKey(item._id, item.type);
                if (!newAssignments[key]) newAssignments[key] = [];
            }
            return { cart: newCart, serviceStaffAssignments: newAssignments };
        });
    };

    const removeFromCart = (itemId: string, type: string) => {
        updateActiveBill(bill => {
            const newCart = bill.cart.filter(i => !(i._id === itemId && i.type === type));
            const newAssignments = { ...bill.serviceStaffAssignments };
            if (type === 'Service') {
                delete newAssignments[getCartItemKey(itemId, type)];
            }
            return { cart: newCart, serviceStaffAssignments: newAssignments };
        });
    };

    const updateQuantity = (itemId: string, type: string, delta: number) => {
        updateActiveBill(bill => ({
            cart: bill.cart.map(i => i._id === itemId && i.type === type
                ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                : i)
        }));
    };

    // Note: Apply similar `updateActiveBill` logic to `addServiceStaffAssignment`, `removeServiceStaffAssignment`, and `updateServiceStaffPercentage`.

    const addServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        if (!activeBill) return;

        const key = getCartItemKey(itemId, type);
        const current = activeBill.serviceStaffAssignments[key] || [];
        if (current.find(a => a.staffId === staffId)) return;

        const staff = staffList.find(s => s._id === staffId);
        const newAssignments = [
            ...(activeBill.serviceStaffAssignments[key] || []),
            {
                staffId,
                percentage: staff?.commissionRate || 0
            }
        ];

        updateActiveBill({
            serviceStaffAssignments: {
                ...activeBill.serviceStaffAssignments,
                [key]: newAssignments
            }
        });
    };

    const removeServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        if (!activeBill) return;

        const key = getCartItemKey(itemId, type);
        const newAssignments = (activeBill.serviceStaffAssignments[key] || []).filter(a => a.staffId !== staffId);

        updateActiveBill({
            serviceStaffAssignments: {
                ...activeBill.serviceStaffAssignments,
                [key]: newAssignments
            }
        });
    };

    const updateServiceStaffPercentage = (itemId: string, type: string, staffId: string, percentage: number) => {
        if (!activeBill) return;

        const key = getCartItemKey(itemId, type);
        const newAssignments = (activeBill.serviceStaffAssignments[key] || []).map(a =>
            a.staffId === staffId ? { ...a, percentage } : a
        );

        updateActiveBill({
            serviceStaffAssignments: {
                ...activeBill.serviceStaffAssignments,
                [key]: newAssignments
            }
        });
    };

    const calculateTotal = () => {
        if (!activeBill) return { subtotal: 0, tax: 0, total: 0, commission: 0, assignments: [] };
        const subtotal = activeBill.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (settings.taxRate / 100);
        const total = subtotal + tax - activeBill.discount;

        // Commission calculation aggregated per staff from per-service assignments
        let totalCommission = 0;
        const perStaff: Record<string, { staffId: string; commission: number }> = {};

        const serviceNetBase = activeBill.cart.reduce((sum, item) => {
            if (item.type !== 'Service') return sum;
            const itemTotal = item.price * item.quantity;
            const serviceNet = subtotal > 0 ? (total * (itemTotal / subtotal)) : 0;
            return sum + serviceNet;
        }, 0);

        activeBill.cart.forEach(item => {
            if (item.type !== 'Service') return;
            const key = getCartItemKey(item._id, item.type);
            const itemTotal = item.price * item.quantity;
            const serviceNet = subtotal > 0 ? (total * (itemTotal / subtotal)) : 0;
            const serviceAssignments = activeBill.serviceStaffAssignments[key] || [];

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
        if (!activeBill) return;
        if (!activeBill.selectedCustomer) {
            alert("Please select a customer");
            return;
        }
        if (activeBill.cart.length === 0) {
            alert("Cart is empty");
            return;
        }
        const serviceItems = activeBill.cart.filter(item => item.type === 'Service');
        for (const item of serviceItems) {
            const key = getCartItemKey(item._id, item.type);
            const itemAssignments = activeBill.serviceStaffAssignments[key] || [];
            const percentTotal = itemAssignments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
            if (percentTotal > 100) {
                alert(`Staff percentage for service "${item.name}" cannot exceed 100%`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const { subtotal, tax, total, commission, assignments } = calculateTotal();

            const paid = activeBill.amountPaid === "" ? total : parseFloat(activeBill.amountPaid.toString());
            const status = paid >= total ? "paid" : "partially_paid";

            // Handle walking customer by setting customer to undefined
            const customerId = activeBill.selectedCustomer === 'walking-customer' ? undefined : activeBill.selectedCustomer;

            const payload = {
                customer: customerId,
                items: activeBill.cart.map(item => ({
                    item: item._id,
                    itemModel: item.type,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity
                })),
                subtotal,
                tax,
                discount: activeBill.discount,
                totalAmount: total,
                commission,
                staffAssignments: assignments.map(a => ({
                    staff: a.staffId,
                    percentage: a.percentage,
                    commission: a.commission
                })),
                staff: assignments[0]?.staffId || undefined, // Keep primary staff for compatibility
                amountPaid: paid,
                paymentMethod: activeBill.paymentMethod,
                status: status
            };

            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                // IMPORTANT: Remove this bill after successful checkout
                setBills(prev => {
                    const remaining = prev.filter(b => b.id !== activeBillId);
                    if (remaining.length === 0) {
                        const fresh = createEmptyBill();
                        setActiveBillId(fresh.id);
                        return [fresh];
                    }
                    setActiveBillId(remaining[0].id);
                    return remaining;
                });
                // If there's a payment, create a deposit record
                if (paid > 0) {
                    await fetch("/api/deposits", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            invoice: data.data._id,
                            customer: customerId,
                            amount: paid,
                            paymentMethod: activeBill.paymentMethod,
                            notes: "Initial payment from POS"
                        }),
                    });
                }
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
                
                {/* 1. BILL TABS UI */}
                <div className="flex overflow-x-auto bg-gray-100 border-b border-gray-200 hide-scrollbar p-1 flex-shrink-0">
                    {bills.map((bill) => (
                        <div
                            key={bill.id}
                            onClick={() => switchBill(bill.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 min-w-[100px] cursor-pointer rounded-t-md text-xs font-semibold border-b-2 transition-colors ${
                                activeBillId === bill.id 
                                    ? "bg-white text-blue-900 border-blue-900 shadow-sm" 
                                    : "text-gray-500 border-transparent hover:bg-gray-200"
                            }`}
                        >
                            <span className="nowrap flex-1">{bill.name}</span>
                            {bills.length > 1 && (
                                <button 
                                    onClick={(e) => handleRemoveClick(bill.id, e)} 
                                    className="text-gray-400 hover:text-red-500 p-0.5"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    <button 
                        onClick={addNewBill}
                        className="flex items-center justify-center px-3 py-1.5 text-blue-900 hover:bg-blue-50 rounded text-xs font-bold shrink-0 ml-1"
                    >
                        <Plus className="w-3 h-3 mr-1" /> New Bill
                    </button>
                </div>

                {/* 2. ACTIVE BILL CONTENT */}
                {isMounted && activeBill && (
                    <div className="bg-white flex flex-col h-full overflow-hidden">
                        
                        {/* Customer Selection */}
                        <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                                <SearchableSelect
                                    placeholder="Select Customer"
                                    value={activeBill.selectedCustomer}
                                    onChange={(val) => updateActiveBill({ selectedCustomer: val })}
                                    options={[{ value: 'walking-customer', label: 'Walking Customer' }, ...customers.map(c => ({ value: c._id, label: `${c.name} ${c.phone ? `(${c.phone})` : ''}` }))]}
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-2 pb-24 md:pb-2">
                            {activeBill.cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                                    <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
                                    <p className="text-xs md:text-sm">Cart is empty</p>
                                </div>
                            ) : (
                                activeBill.cart.map(item => (
                                    <div key={`${item.type}-${item._id}`} className="p-2 border border-gray-100 rounded-lg bg-white shadow-sm space-y-2">
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
                                                {(activeBill.serviceStaffAssignments[getCartItemKey(item._id, item.type)] || []).length > 0 && (
                                                    <div className="space-y-1">
                                                        {(activeBill.serviceStaffAssignments[getCartItemKey(item._id, item.type)] || []).map(assignment => {
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

                        {/* Summary Section */}
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
                                        value={activeBill.discount}
                                        onChange={(e) => updateActiveBill({ discount: parseFloat(e.target.value) || 0 })}
                                        className="w-16 text-right text-[10px] md:text-xs border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-900 outline-none"
                                        min="0"
                                    />
                                </div>
                                <div className="flex justify-between items-center text-blue-900 border-t border-gray-200 pt-1.5 mt-1">
                                    <span className="text-[10px] font-bold">Paid</span>
                                    <input
                                        type="number"
                                        placeholder={total.toFixed(2)}
                                        value={activeBill.amountPaid}
                                        onChange={(e) => updateActiveBill({ amountPaid: e.target.value })}
                                        className="w-20 text-right text-[10px] md:text-xs border-2 border-blue-900/20 rounded px-1 py-0.5 focus:border-blue-900 outline-none font-bold"
                                    />
                                </div>
                                <div className="flex justify-between text-sm md:text-base font-black text-gray-900 pt-1 border-t border-gray-200">
                                    <span> {(activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? 'Due' : 'Total'}</span>
                                    <span className={(activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? 'text-red-600' : 'text-blue-900'}>
                                        {settings.symbol}{((activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? (total - parseFloat(activeBill.amountPaid.toString())) : total).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-3">
                                <div className="grid grid-cols-3 gap-1 md:gap-1.5">
                                    {['Cash', 'Card', 'Wallet'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => updateActiveBill({ paymentMethod: method })}
                                            className={`py-1.5 text-[9px] md:text-[10px] uppercase tracking-wider font-bold rounded border transition-all ${activeBill.paymentMethod === method ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
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
                )}
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
                        {activeBill && activeBill.cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                {activeBill.cart.reduce((a, b) => a + b.quantity, 0)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold">Cart</span>
                    {mobileTab === 'cart' && <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>}
                </button>
            </div>
            {/* THÊM VÀO ĐÂY: Modal Xác nhận xóa Bill */}
            {billToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa hóa đơn</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Bạn có chắc chắn muốn xóa hóa đơn này không? Các sản phẩm đã chọn trong bill sẽ bị mất.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 w-full">
                            <button
                                onClick={() => setBillToDelete(null)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-bold transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmRemoveBill}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold transition-colors shadow-sm"
                            >
                                Đồng ý xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
    );
}
