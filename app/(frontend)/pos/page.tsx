
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Scissors as ScissorsIcon, Package, LayoutDashboard, Edit, X } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { formatCurrency } from "@/lib/currency";
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
    selectedQrIndex: number;
    amountPaid: number | string;
    editInvoiceId?: string;
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
        paymentMethod: "Tiền mặt",
        selectedQrIndex: 0,
        amountPaid: "",
        editInvoiceId: undefined
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
    // --- THÊM STATE CHO TẠO KHÁCH HÀNG NHANH ---
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
    // THÊM DÒNG NÀY: State để lưu ID của bill đang chuẩn bị xóa (mở modal)
    const [billToDelete, setBillToDelete] = useState<string | null>(null);
    const [billSearchQuery, setBillSearchQuery] = useState("");
    // Load bills from localStorage on mount
    useEffect(() => {
        setIsMounted(true);
        const params = new URLSearchParams(window.location.search);
        const editId = params.get("edit");

        if (editId) {
            fetch(`/api/invoices/${editId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        const inv = data.data;

                        if (inv.status !== 'pending') {
                            alert("Chỉ hóa đơn ở trạng thái Pending mới có thể chỉnh sửa.");
                            window.history.replaceState({}, '', '/pos');
                            return;
                        }

                        const editBill: Bill = {
                            id: `edit-${inv._id}`,
                            editInvoiceId: inv._id,
                            name: `Edit: ${inv.invoiceNumber}`,
                            cart: inv.items.map((item: any) => ({
                                _id: item.item._id || item.item,
                                name: item.name,
                                price: item.price,
                                type: item.itemModel,
                                quantity: item.quantity
                            })),
                            selectedCustomer: inv.customer?._id || "",
                            serviceStaffAssignments: {},
                            discount: inv.subtotal > 0 ? Math.round(((inv.discount || 0) / inv.subtotal) * 100) : 0,
                            paymentMethod: inv.paymentMethod || "Tiền mặt",
                            selectedQrIndex: 0,
                            amountPaid: inv.amountPaid === 0 ? "" : inv.amountPaid,
                        };
                        setBills(prev => {
                            const newBills = [...prev.filter(b => b.id !== editBill.id), editBill];
                            return newBills;
                        });
                        setActiveBillId(editBill.id);
                        window.history.replaceState({}, '', '/pos');
                    }
                })
                .catch(console.error);
            return;
        }

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

    // --- HÀM TẠO KHÁCH HÀNG NHANH ---
    const handleCreateCustomer = async () => {
        if (!newCustomerName.trim()) {
            alert("Vui lòng nhập tên khách hàng");
            return;
        }

        setIsSubmittingCustomer(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newCustomerName,
                    phone: newCustomerPhone
                }),
            });
            const data = await res.json();

            if (data.success) {
                // 1. Thêm khách hàng mới vào danh sách hiện tại
                setCustomers(prev => [...prev, data.data]);

                // 2. Tự động chọn khách hàng này cho hóa đơn đang mở
                updateActiveBill({ selectedCustomer: data.data._id });

                // 3. Đóng modal và reset form
                setIsAddCustomerModalOpen(false);
                setNewCustomerName("");
                setNewCustomerPhone("");
            } else {
                alert(data.error || "Không thể tạo khách hàng. Vui lòng thử lại.");
            }
        } catch (error) {
            console.error(error);
            alert("Đã xảy ra lỗi khi tạo khách hàng");
        } finally {
            setIsSubmittingCustomer(false);
        }
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
        if (!activeBill) return { subtotal: 0, tax: 0, total: 0, discountAmount: 0, commission: 0, assignments: [] };
        const subtotal = activeBill.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * (settings.taxRate / 100);
        const discountAmount = subtotal * ((activeBill.discount || 0) / 100);
        const total = subtotal + tax - discountAmount;

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
        //return vào database
        return { subtotal, tax, total, discountAmount, commission: totalCommission, assignments: updatedAssignments };
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

        let qrCodeImage = "";
        let bankDetails = "";
        let paymentQrId = undefined;
        if (activeBill.paymentMethod === "Mã QR" && settings?.qrCodes?.[activeBill.selectedQrIndex]) {
            const qr = settings.qrCodes[activeBill.selectedQrIndex];
            qrCodeImage = qr.image;
            bankDetails = `${qr.bankName} | ${qr.accountNumber} | ${qr.name}`;
            paymentQrId = qr.qrId;
        }

        setSubmitting(true);
        try {
            const { subtotal, tax, total, discountAmount, commission, assignments } = calculateTotal();

            const paid = activeBill.amountPaid === "" ? 0 : parseFloat(activeBill.amountPaid.toString());
            const status = "pending"; // POS tạo đơn luôn pending, hoàn tất ở trang invoice

            // Handle walking customer by setting customer to undefined
            const customerId = activeBill.selectedCustomer === 'walking-customer' ? undefined : activeBill.selectedCustomer;
            const selectedQr = settings?.qrCodes?.[activeBill.selectedQrIndex || 0];
            const paymentQrIdString = activeBill.paymentMethod === 'Mã QR'
                ? selectedQr?.qrId
                : null;
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
                discount: discountAmount,
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
                paymentQrId: paymentQrIdString,
                status: status,
                qrCodeImage: qrCodeImage,
                bankDetails: bankDetails
            };


            const url = activeBill.editInvoiceId ? `/api/invoices/${activeBill.editInvoiceId}` : "/api/invoices";
            const method = activeBill.editInvoiceId ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
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

                // NOTE: tắt gửi Zalo đối với POS ở đây theo yêu cầu.
                // Khi nhấn nút "Thanh toán thành công" trên trang invoice id mới gửi Zalo.
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

    const filteredBills = bills.filter(b => b.name.toLowerCase().includes(billSearchQuery.toLowerCase()));
    return (
        <div className="flex h-[100dvh] w-full bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 overflow-hidden flex-col md:flex-row text-black dark:text-white">
            {/* Left Side: Items Catalog */}
            <div className={`flex-1 md:flex-none md:w-[60%] flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
                    {/* Header/Tabs */}
                    <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white">Hệ thống POS</h1>
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                                <button
                                    onClick={() => router.push("/dashboard")}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    <span className="hidden xs:inline">Bảng điều khiển</span>
                                </button>
                                <div className="relative flex-1 sm:w-64 min-w-[150px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs md:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('services')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-primary-900 text-white dark:bg-primary-800' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            >
                                Dịch vụ
                            </button>
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-primary-900 text-white dark:bg-primary-800' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            >
                                Sản phẩm
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 pb-20 md:pb-4">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-900 border-t-transparent"></div></div>
                        ) : (
                            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
                                {filteredItems.map(item => (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        className="bg-white dark:bg-slate-900 p-2 md:p-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center text-center group min-h-[120px] md:min-h-[132px] active:scale-95 duration-75"
                                    >
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                            {item.type === 'Service' ? (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                                                    <ScissorsIcon className="w-4 h-4 md:w-5 md:h-5 text-primary-600 dark:text-primary-400" />
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-[10px] md:text-xs leading-tight line-clamp-2 mb-1 flex items-center justify-center">{item.name}</h3>
                                        <p className="text-primary-900 dark:text-primary-400 font-bold text-xs md:text-sm">{formatCurrency(item.price)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side: Cart */}
            <div className={`w-full md:w-[40%] flex-1 md:flex-none flex flex-col bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 ${mobileTab === 'catalog' ? 'hidden md:flex' : 'flex'} h-full`}>

                {/* --- MỚI: THANH TÌM KIẾM BILL & TẠO BILL MỚI --- */}
                <div className="p-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 flex items-center gap-2 flex-shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="Tìm tên bill..."
                            value={billSearchQuery}
                            onChange={(e) => setBillSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-primary-900"
                        />
                    </div>
                    <button
                        onClick={addNewBill}
                        className="flex items-center justify-center p-1.5 bg-primary-900 text-white hover:bg-primary-800 rounded-md shadow-sm transition-colors"
                        title="Tạo Bill Mới"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* 1. BILL TABS UI */}
                <div className="flex overflow-x-auto bg-gray-100 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 hide-scrollbar p-1 flex-shrink-0">
                    {filteredBills.map((bill) => (
                        <div
                            key={bill.id}
                            onClick={() => switchBill(bill.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 min-w-[100px] cursor-pointer rounded-t-md text-xs font-semibold border-b-2 transition-colors ${activeBillId === bill.id
                                ? "bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 border-primary-900 dark:border-primary-500 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-slate-800"
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
                </div>

                {/* 2. ACTIVE BILL CONTENT */}
                {isMounted && activeBill && (
                    <div className="bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">

                        {/* Customer Selection & Bill Renaming */}
                        <div className="p-3 md:p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 flex-shrink-0 space-y-3">

                            {/* --- MỚI: Ô ĐỔI TÊN BILL --- */}
                            <div className="flex items-center gap-2">
                                <Edit className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Đặt tên Bill (VD: Bàn 1, Chị Hà VIP...)"
                                    value={activeBill.name}
                                    onChange={(e) => updateActiveBill({ name: e.target.value })}
                                    className="flex-1 px-3 py-1.5 text-sm font-bold text-primary-900 dark:text-primary-400 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 transition-all shadow-sm"
                                />
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-900 dark:border-gray-700 flex-shrink-0 space-y-3">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                                    <SearchableSelect
                                        placeholder="Chọn khách hàng"
                                        value={activeBill.selectedCustomer}
                                        onChange={(val) => updateActiveBill({ selectedCustomer: val })}
                                        options={[{ value: 'walking-customer', label: 'Khách vãng lai' }, ...customers.map(c => ({ value: c._id, label: `${c.name} ${c.phone ? `(${c.phone})` : ''}` }))]}
                                        className="flex-1"
                                    />
                                    <button
                                        onClick={() => setIsAddCustomerModalOpen(true)}
                                        className="p-2 bg-primary-100 text-primary-900 rounded-lg hover:bg-primary-200 transition-colors flex-shrink-0"
                                        title="Thêm khách hàng mới"
                                    >
                                        <Plus className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-2 pb-24 md:pb-2">
                            {activeBill.cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 py-10">
                                    <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
                                    <p className="text-xs md:text-sm">Giỏ hàng trống</p>
                                </div>
                            ) : (
                                activeBill.cart.map(item => (
                                    <div key={`${item.type}-${item._id}`} className="p-2 border border-gray-100 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 shadow-sm space-y-2">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                <div className="flex-shrink-0">
                                                    {item.type === 'Service' ? (
                                                        <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                                                            <ScissorsIcon className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                                            <Package className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] md:text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                                                    <p className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400">{settings.symbol}{item.price}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button onClick={() => updateQuantity(item._id, item.type, -1)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-600 dark:text-gray-400"><Minus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                                <span className="text-[10px] md:text-xs font-bold w-4 text-center dark:text-white">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item._id, item.type, 1)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-600 dark:text-gray-400"><Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                                <button onClick={() => removeFromCart(item._id, item.type)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded ml-0.5"><Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                            </div>
                                        </div>
                                        {item.type === 'Service' && (
                                            <div className="pl-8 space-y-1.5">
                                                <SearchableSelect
                                                    placeholder="Phân công nhân viên"
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
                                                                <div key={assignment.staffId} className="flex items-center gap-1.5 bg-primary-50 p-1 rounded border border-primary-100">
                                                                    <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">{staff?.name}</p>
                                                                    <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-primary-200">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            value={assignment.percentage}
                                                                            onChange={(e) => updateServiceStaffPercentage(item._id, item.type, assignment.staffId, parseFloat(e.target.value) || 0)}
                                                                            className="w-6 text-right text-[9px] font-black focus:outline-none"
                                                                        />
                                                                        <span className="text-[9px] font-bold text-primary-900">%</span>
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
                        <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border-t border-gray-200 dark:border-slate-800 overflow-y-auto md:max-h-[45%] pb-20 md:pb-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="space-y-1 mb-3 text-[10px] md:text-xs">
                                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                    <span>Tổng phụ</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                    <span>Thuế ({settings.taxRate}%)</span>
                                    <span>{formatCurrency(tax)}</span>
                                </div>
                                {commission > 0 && (
                                    <div className="space-y-1 bg-indigo-50 dark:bg-indigo-900/10 px-2 py-1.5 rounded border border-indigo-100/50 dark:border-indigo-900/30">
                                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold mb-1 border-b border-indigo-200/50 dark:border-indigo-900/50 pb-0.5">
                                            <span>Tổng hoa hồng</span>
                                            <span>{formatCurrency(commission)}</span>
                                        </div>
                                        {assignments.map((assignment, idx) => {
                                            const staff = staffList.find(s => s._id === assignment.staffId);
                                            return (
                                                <div key={idx} className="flex justify-between text-[9px] text-indigo-500 dark:text-indigo-300 font-medium pl-1">
                                                    <span className="truncate pr-2">{staff?.name}</span>
                                                    <span className="flex-shrink-0">{settings.symbol}{(assignment.commission || 0).toFixed(2)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-600 dark:text-gray-400 items-center border-t border-gray-100 dark:border-slate-800 pt-1 mt-1">
                                    <div className="flex flex-col">
                                        <span>Giảm giá</span>
                                        {activeBill.discount > 0 && (
                                            <span className="text-[9px] font-bold text-red-500">
                                                -{formatCurrency(subtotal * (activeBill.discount / 100))}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={activeBill.discount || ""}
                                            onChange={(e) => {
                                                let val = parseFloat(e.target.value) || 0;
                                                if (val > 100) val = 100;
                                                updateActiveBill({ discount: val });
                                            }}
                                            className="w-12 text-right text-[10px] md:text-xs border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-900 outline-none"
                                            min="0"
                                            max="100"
                                            placeholder="0"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold">%</span>
                                    </div>
                                </div>                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 border-t border-gray-200 pt-1.5 mt-1">
                                    <span className="text-[10px] font-bold">Đã thanh toán</span>
                                    <input
                                        type="number"
                                        placeholder={total.toFixed(2)}
                                        value={activeBill.amountPaid}
                                        onChange={(e) => updateActiveBill({ amountPaid: e.target.value })}
                                        className="w-20 text-right text-[10px] md:text-xs border-2 border-primary-900/20 dark:border-primary-900/50 rounded px-1 py-0.5 focus:border-primary-900 bg-white dark:bg-slate-950 text-gray-900 dark:text-white outline-none font-bold"
                                    />
                                </div>
                                <div className="flex justify-between text-sm md:text-base font-black text-gray-900 dark:text-white dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-slate-800">
                                    <span> {(activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? 'Còn nợ' : 'Tổng cộng'}</span>
                                    <span className={(activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? 'text-red-600 dark:text-red-400' : 'text-primary-900 dark:text-primary-400'}>
                                        {formatCurrency(((activeBill.amountPaid !== "" && parseFloat(activeBill.amountPaid.toString()) < total) ? (total - parseFloat(activeBill.amountPaid.toString())) : total))}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-3">
                                <div className="mb-3 space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Tiền mặt', 'Mã QR', 'Cà thẻ'].map(method => (
                                            <button
                                                key={method}
                                                onClick={() => updateActiveBill({ paymentMethod: method })}
                                                className={`py-2 text-[11px] md:text-xs uppercase tracking-wider font-bold rounded-lg border transition-all ${activeBill.paymentMethod === method ? 'bg-primary-900 text-white border-primary-900 shadow-sm' : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'}`}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Hiển thị danh sách QR nếu chọn Mã QR */}
                                    {activeBill.paymentMethod === 'Mã QR' && settings?.qrCodes && settings.qrCodes.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-top-1">
                                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 block">Chọn mã QR hiển thị:</label>
                                            <select
                                                value={activeBill.selectedQrIndex}
                                                onChange={(e) => updateActiveBill({ selectedQrIndex: parseInt(e.target.value) })}
                                                className="w-full p-2 text-xs border border-primary-200 dark:border-primary-900/50 rounded-lg focus:ring-1 focus:ring-primary-900 bg-primary-50/50 dark:bg-primary-900/10 text-gray-900 dark:text-white outline-none font-medium"
                                            >
                                                {settings.qrCodes.map((qr: any, idx: number) => (
                                                    <option key={idx} value={idx} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">{qr.name} - {qr.bankName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <FormButton
                                onClick={handleCheckout}
                                loading={submitting}
                                variant="success"
                                className="w-full py-4 md:py-4 text-xs md:text-sm uppercase tracking-widest font-black shadow-lg hover:shadow-xl active:translate-y-0.5 transition-all mb-4"
                                icon={<CreditCard className="w-4 h-4" />}
                            >
                                Hoàn thành đơn hàng
                            </FormButton>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-around h-16 z-50 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setMobileTab('catalog')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all ${mobileTab === 'catalog' ? 'text-primary-900 dark:text-primary-400 scale-110' : 'text-gray-400 dark:text-gray-500'}`}
                >
                    <LayoutDashboard className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Danh mục</span>
                    {mobileTab === 'catalog' && <div className="absolute top-0 w-8 h-1 bg-primary-900 dark:bg-primary-500 rounded-b-full"></div>}
                </button>
                <div className="w-px h-8 bg-gray-100 dark:bg-slate-800"></div>
                <button
                    onClick={() => setMobileTab('cart')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all relative ${mobileTab === 'cart' ? 'text-primary-900 dark:text-primary-400 scale-110' : 'text-gray-400 dark:text-gray-500'}`}
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5 mb-1" />
                        {activeBill && activeBill.cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                {activeBill.cart.reduce((a, b) => a + b.quantity, 0)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold">Giỏ hàng</span>
                    {mobileTab === 'cart' && <div className="absolute top-0 w-8 h-1 bg-primary-900 dark:bg-primary-500 rounded-b-full"></div>}
                </button>
            </div>
            {/* THÊM VÀO ĐÂY: Modal Xác nhận xóa Bill */}
            {billToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Xác nhận xóa hóa đơn</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Bạn có chắc chắn muốn xóa hóa đơn này không? Các sản phẩm đã chọn trong bill sẽ bị mất.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 w-full">
                            <button
                                onClick={() => setBillToDelete(null)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-bold transition-colors"
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
            {/* THÊM VÀO ĐÂY: Modal Tạo Khách Hàng Nhanh */}
            {isAddCustomerModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Thêm khách hàng mới</h3>
                            <button
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                                    Tên khách hàng <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900 focus:border-primary-900 transition-shadow bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                                    placeholder="Nhập tên khách hàng..."
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                                    Số điện thoại
                                </label>
                                <input
                                    type="text"
                                    value={newCustomerPhone}
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900 focus:border-primary-900 transition-shadow bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                                    placeholder="Nhập số điện thoại..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 w-full border-t border-gray-100 dark:border-slate-800 pt-4">
                            <button
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-bold transition-colors"
                                disabled={isSubmittingCustomer}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                disabled={isSubmittingCustomer || !newCustomerName.trim()}
                                className="px-5 py-2.5 bg-primary-900 text-white rounded-lg hover:bg-primary-800 text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmittingCustomer ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white dark:border-gray-700/30 border-t-white rounded-full animate-spin"></div>
                                        Đang lưu...
                                    </>
                                ) : (
                                    "Lưu khách hàng"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>

    );
}
