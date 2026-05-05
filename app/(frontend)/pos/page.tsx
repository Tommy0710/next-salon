"use client";

import toast from "react-hot-toast";
import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    ShoppingCart,
    LayoutDashboard,
    Trash2,
    X,
} from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useDebounce } from "@/hooks/useDebounce";
import { ProductGrid } from "./components/ProductGrid";
import { CartPanel } from "./components/CartPanel";
import type { Bill, Item, Customer, StaffMember, Totals } from "./types";
import {
    createEmptyBill,
    getCartItemKey,
    computeTotals,
    EMPTY_TOTALS,
} from "./utils";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function POSPage() {
    const router = useRouter();
    const { settings } = useSettings();

    // ── Catalog state ──────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<"services" | "products">(
        "services"
    );
    const [services, setServices] = useState<Item[]>([]);
    const [products, setProducts] = useState<Item[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebounce(searchInput, 300);

    // ── Bill state ─────────────────────────────────────────────────────────────
    const [isMounted, setIsMounted] = useState(false);
    const [bills, setBills] = useState<Bill[]>([]);
    const [activeBillId, setActiveBillId] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [billSearchQuery, setBillSearchQuery] = useState("");
    const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");

    // ── Modal state ────────────────────────────────────────────────────────────
    const [billToDelete, setBillToDelete] = useState<string | null>(null);
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [newCustomerGender, setNewCustomerGender] = useState("other");
    const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

    const [, startTransition] = useTransition();

    // ── Stable refs (avoid stale closures in memoized handlers) ──────────────
    const activeBillIdRef = useRef(activeBillId);
    const customersRef = useRef(customers);
    const staffListRef = useRef(staffList);
    const settingsRef = useRef(settings);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    activeBillIdRef.current = activeBillId;
    customersRef.current = customers;
    staffListRef.current = staffList;
    settingsRef.current = settings;

    // ── Derived ────────────────────────────────────────────────────────────────
    const activeBill = useMemo(
        () => bills.find((b) => b.id === activeBillId) ?? bills[0],
        [bills, activeBillId]
    );

    const filteredItems = useMemo(() => {
        const source = activeTab === "services" ? services : products;
        if (!debouncedSearch.trim()) return source;
        const lower = debouncedSearch.toLowerCase();
        return source.filter((item) =>
            item.name.toLowerCase().includes(lower)
        );
    }, [activeTab, services, products, debouncedSearch]);

    const totals = useMemo<Totals>(() => {
        if (!activeBill) return EMPTY_TOTALS;
        return computeTotals(activeBill, customers, settings.taxRate ?? 0);
    }, [activeBill, customers, settings.taxRate]);

    // ── Load from localStorage on mount ───────────────────────────────────────
    useEffect(() => {
        setIsMounted(true);
        const params = new URLSearchParams(window.location.search);
        const editId = params.get("edit");

        if (editId) {
            fetch(`/api/invoices/${editId}`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.success && data.data) {
                        const inv = data.data;
                        if (inv.status !== "pending") {
                            toast.error(
                                "Chỉ hóa đơn ở trạng thái Pending mới có thể chỉnh sửa."
                            );
                            window.history.replaceState({}, "", "/pos");
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
                                quantity: item.quantity,
                            })),
                            selectedCustomer: inv.customer?._id || "",
                            serviceStaffAssignments: {},
                            discount: inv.discount || 0,
                            discountType: "fixed",
                            paymentMethod: inv.paymentMethod || "Tiền mặt",
                            selectedQrIndex: 0,
                            amountPaid:
                                inv.amountPaid === 0 ? "" : inv.amountPaid,
                            walletAmountUsed: 0,
                        };
                        setBills((prev) => [
                            ...prev.filter((b) => b.id !== editBill.id),
                            editBill,
                        ]);
                        setActiveBillId(editBill.id);
                        window.history.replaceState({}, "", "/pos");
                    }
                })
                .catch(console.error);
            return;
        }

        const savedBills = localStorage.getItem("pos_waiting_bills");
        const savedActiveId = localStorage.getItem("pos_active_bill_id");

        if (savedBills) {
            try {
                const parsed: Bill[] = JSON.parse(savedBills);
                if (parsed.length > 0) {
                    setBills(parsed);
                    setActiveBillId(savedActiveId || parsed[0].id);
                    return;
                }
            } catch {
                // corrupt storage - fall through to default
            }
        }

        const initial = createEmptyBill();
        setBills([initial]);
        setActiveBillId(initial.id);
    }, []);

    // ── Debounced localStorage save ────────────────────────────────────────────
    useEffect(() => {
        if (!isMounted || bills.length === 0) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            localStorage.setItem("pos_waiting_bills", JSON.stringify(bills));
            localStorage.setItem("pos_active_bill_id", activeBillId);
        }, 400);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [bills, activeBillId, isMounted]);

    // ── Fetch POS data (single endpoint) ──────────────────────────────────────
    useEffect(() => {
        async function fetchPosData() {
            setLoading(true);
            try {
                const res = await fetch("/api/pos-init");
                const json = await res.json();
                if (json.success) {
                    const { services: s, products: p, customers: c, staff: st } =
                        json.data;
                    setServices(s);
                    setProducts(p);
                    setCustomers(c);
                    setStaffList(st);
                }
            } catch (err) {
                console.error("[POS] fetch error", err);
            } finally {
                setLoading(false);
            }
        }
        fetchPosData();
    }, []);

    // ── Bill management ────────────────────────────────────────────────────────

    const updateActiveBill = useCallback(
        (updates: Partial<Bill> | ((prev: Bill) => Partial<Bill>)) => {
            setBills((prev) =>
                prev.map((bill) => {
                    if (bill.id !== activeBillIdRef.current) return bill;
                    const vals =
                        typeof updates === "function" ? updates(bill) : updates;
                    return { ...bill, ...vals };
                })
            );
        },
        []
    );

    const addNewBill = useCallback(() => {
        const nb = createEmptyBill();
        setBills((prev) => [...prev, nb]);
        setActiveBillId(nb.id);
    }, []);

    const switchBill = useCallback((id: string) => setActiveBillId(id), []);

    const handleRemoveClick = useCallback(
        (id: string, e: React.MouseEvent) => {
            e.stopPropagation();
            setBillToDelete(id);
        },
        []
    );

    const confirmRemoveBill = useCallback(() => {
        if (!billToDelete) return;
        setBills((prev) => {
            const filtered = prev.filter((b) => b.id !== billToDelete);
            if (filtered.length === 0) {
                const fresh = createEmptyBill();
                setActiveBillId(fresh.id);
                return [fresh];
            }
            if (billToDelete === activeBillIdRef.current) {
                setActiveBillId(filtered[filtered.length - 1].id);
            }
            return filtered;
        });
        setBillToDelete(null);
    }, [billToDelete]);

    // ── Cart actions (stable via ref pattern) ──────────────────────────────────

    const addToCart = useCallback(
        (item: Item) => {
            updateActiveBill((bill) => {
                const existing = bill.cart.find(
                    (i) => i._id === item._id && i.type === item.type
                );
                const newCart = existing
                    ? bill.cart.map((i) =>
                        i._id === item._id && i.type === item.type
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    )
                    : [...bill.cart, { ...item, quantity: 1 }];

                const newAssignments = { ...bill.serviceStaffAssignments };
                if (item.type === "Service") {
                    const key = getCartItemKey(item._id, item.type);
                    if (!newAssignments[key]) newAssignments[key] = [];
                }
                return {
                    cart: newCart,
                    serviceStaffAssignments: newAssignments,
                };
            });
        },
        [updateActiveBill]
    );

    const updateQuantity = useCallback(
        (itemId: string, type: string, delta: number) => {
            updateActiveBill((bill) => ({
                cart: bill.cart.map((i) =>
                    i._id === itemId && i.type === type
                        ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                        : i
                ),
            }));
        },
        [updateActiveBill]
    );

    const removeFromCart = useCallback(
        (itemId: string, type: string) => {
            updateActiveBill((bill) => {
                const newCart = bill.cart.filter(
                    (i) => !(i._id === itemId && i.type === type)
                );
                const newAssignments = { ...bill.serviceStaffAssignments };
                if (type === "Service")
                    delete newAssignments[getCartItemKey(itemId, type)];
                return {
                    cart: newCart,
                    serviceStaffAssignments: newAssignments,
                };
            });
        },
        [updateActiveBill]
    );

    const addStaff = useCallback(
        (itemId: string, type: string, staffId: string) => {
            const staff = staffListRef.current.find((s) => s._id === staffId);
            updateActiveBill((bill) => {
                const key = getCartItemKey(itemId, type);
                const current = bill.serviceStaffAssignments[key] || [];
                if (current.find((a) => a.staffId === staffId)) return {};
                return {
                    serviceStaffAssignments: {
                        ...bill.serviceStaffAssignments,
                        [key]: [
                            ...current,
                            {
                                staffId,
                                percentage: staff?.commissionRate || 0,
                            },
                        ],
                    },
                };
            });
        },
        [updateActiveBill]
    );

    const removeStaff = useCallback(
        (itemId: string, type: string, staffId: string) => {
            updateActiveBill((bill) => {
                const key = getCartItemKey(itemId, type);
                return {
                    serviceStaffAssignments: {
                        ...bill.serviceStaffAssignments,
                        [key]: (
                            bill.serviceStaffAssignments[key] || []
                        ).filter((a) => a.staffId !== staffId),
                    },
                };
            });
        },
        [updateActiveBill]
    );

    const updateStaffPct = useCallback(
        (itemId: string, type: string, staffId: string, pct: number) => {
            updateActiveBill((bill) => {
                const key = getCartItemKey(itemId, type);
                return {
                    serviceStaffAssignments: {
                        ...bill.serviceStaffAssignments,
                        [key]: (bill.serviceStaffAssignments[key] || []).map(
                            (a) =>
                                a.staffId === staffId ? { ...a, percentage: pct } : a
                        ),
                    },
                };
            });
        },
        [updateActiveBill]
    );

    // ── Checkout ───────────────────────────────────────────────────────────────

    const handleCheckout = useCallback(async () => {
        if (!activeBill) return;
        if (!activeBill.selectedCustomer) {
            toast.error("Please select a customer");
            return;
        }
        if (activeBill.cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        for (const item of activeBill.cart.filter(
            (i) => i.type === "Service"
        )) {
            const key = getCartItemKey(item._id, item.type);
            const pctTotal = (activeBill.serviceStaffAssignments[key] || [])
                .reduce((s, a) => s + (Number(a.percentage) || 0), 0);
            if (pctTotal > 100) {
                toast.error(
                    `Staff percentage for "${item.name}" cannot exceed 100%`
                );
                return;
            }
        }

        const currentSettings = settingsRef.current;
        let qrCodeImage = "";
        let bankDetails = "";
        if (
            activeBill.paymentMethod === "Mã QR" &&
            currentSettings?.qrCodes?.[activeBill.selectedQrIndex]
        ) {
            const qr = currentSettings.qrCodes[activeBill.selectedQrIndex];
            qrCodeImage = qr.image;
            bankDetails = `${qr.bankName} | ${qr.accountNumber} | ${qr.name}`;
        }

        setSubmitting(true);
        try {
            const {
                subtotal,
                tax,
                total,
                discountAmount,
                commission,
                assignments,
                walletUsed,
            } = totals;

            const paid =
                activeBill.amountPaid === ""
                    ? 0
                    : parseFloat(activeBill.amountPaid.toString());
            const customerId =
                activeBill.selectedCustomer === "walking-customer"
                    ? undefined
                    : activeBill.selectedCustomer;
            const selectedQr =
                currentSettings?.qrCodes?.[activeBill.selectedQrIndex || 0];

            const payload = {
                customer: customerId,
                items: activeBill.cart.map((item) => ({
                    item: item._id,
                    itemModel: item.type,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity,
                    productType: item.productType || "PRODUCT",
                })),
                subtotal,
                tax,
                discount: discountAmount,
                totalAmount: total,
                walletUsed,
                commission,
                staffAssignments: assignments.map((a) => ({
                    staff: a.staffId,
                    percentage: a.percentage,
                    commission: a.commission,
                })),
                staff: assignments[0]?.staffId || undefined,
                amountPaid: paid,
                paymentMethod: activeBill.paymentMethod,
                paymentQrId:
                    activeBill.paymentMethod === "Mã QR"
                        ? selectedQr?.qrId
                        : null,
                status: "pending",
                qrCodeImage,
                bankDetails,
            };

            const url = activeBill.editInvoiceId
                ? `/api/invoices/${activeBill.editInvoiceId}`
                : "/api/invoices";
            const method = activeBill.editInvoiceId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.success) {
                setBills((prev) => {
                    const remaining = prev.filter((b) => b.id !== activeBillId);
                    if (remaining.length === 0) {
                        const fresh = createEmptyBill();
                        setActiveBillId(fresh.id);
                        return [fresh];
                    }
                    setActiveBillId(remaining[0].id);
                    return remaining;
                });

                if (paid > 0) {
                    fetch("/api/deposits", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            invoice: data.data._id,
                            customer: customerId,
                            amount: paid,
                            paymentMethod: activeBill.paymentMethod,
                            notes: "Initial payment from POS",
                        }),
                    }).catch(console.error);
                }

                router.push(`/invoices/print/${data.data._id}`);
            } else {
                toast.error(data.error || "Failed to create invoice");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error processing checkout");
        } finally {
            setSubmitting(false);
        }
    }, [activeBill, activeBillId, totals, router]);

    // ── Cancel edit ────────────────────────────────────────────────────────────

    const handleCancelEdit = useCallback(() => {
        if (!confirm("Hủy chỉnh sửa? Mọi thay đổi sẽ không được lưu.")) return;
        setBills((prev) => {
            const remaining = prev.filter(
                (b) => b.id !== activeBillIdRef.current
            );
            if (remaining.length === 0) {
                const fresh = createEmptyBill();
                setActiveBillId(fresh.id);
                return [fresh];
            }
            setActiveBillId(remaining[0].id);
            return remaining;
        });
    }, []);

    // ── Add customer ───────────────────────────────────────────────────────────

    const handleCreateCustomer = useCallback(async () => {
        if (!newCustomerName.trim()) {
            toast.error("Vui lòng nhập tên khách hàng");
            return;
        }
        if (!newCustomerPhone.trim()) {
            toast.error("Vui lòng nhập số điện thoại khách hàng");
            return;
        }
        setIsSubmittingCustomer(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newCustomerName,
                    phone: newCustomerPhone,
                    gender: newCustomerGender,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setCustomers((prev) => [...prev, data.data]);
                updateActiveBill({ selectedCustomer: data.data._id });
                setIsAddCustomerModalOpen(false);
                setNewCustomerName("");
                setNewCustomerPhone("");
                setNewCustomerGender("other");
            } else {
                toast.error(
                    data.error || "Không thể tạo khách hàng. Vui lòng thử lại."
                );
            }
        } catch (err) {
            console.error(err);
            toast.error("Đã xảy ra lỗi khi tạo khách hàng");
        } finally {
            setIsSubmittingCustomer(false);
        }
    }, [
        newCustomerName,
        newCustomerPhone,
        newCustomerGender,
        updateActiveBill,
    ]);

    // ── Tab switch with transition ─────────────────────────────────────────────

    const handleTabChange = useCallback(
        (tab: "services" | "products") => {
            startTransition(() => setActiveTab(tab));
        },
        [startTransition]
    );

    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchInput(e.target.value),
        []
    );

    const openAddCustomerModal = useCallback(
        () => setIsAddCustomerModalOpen(true),
        []
    );

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex h-[100dvh] w-full bg-gray-50 dark:bg-slate-950 overflow-hidden flex-col md:flex-row text-black dark:text-white">
            {/* ── LEFT: Catalog ── */}
            <div
                className={`flex-1 md:flex-none md:w-[60%] flex flex-col min-w-0 min-h-0 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${mobileTab === "cart" ? "hidden md:flex" : "flex"
                    }`}
            >
                {/* Header */}
                <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white">
                            Hệ thống POS
                        </h1>
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                            <button
                                onClick={() => router.push("/dashboard")}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                <span className="hidden xs:inline">
                                    Bảng điều khiển
                                </span>
                            </button>
                            <div className="relative flex-1 sm:w-64 min-w-[150px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Tìm sản phẩm..."
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs md:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTabChange("services")}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === "services"
                                    ? "bg-primary-900 text-white dark:bg-primary-800"
                                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                                }`}
                        >
                            Dịch vụ
                        </button>
                        <button
                            onClick={() => handleTabChange("products")}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === "products"
                                    ? "bg-primary-900 text-white dark:bg-primary-800"
                                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                                }`}
                        >
                            Sản phẩm
                        </button>
                    </div>
                </div>

                {/* Virtualized product grid */}
                <ProductGrid
                    items={filteredItems}
                    loading={loading}
                    onAddToCart={addToCart}
                />
            </div>

            {/* ── RIGHT: Cart ── */}
            <div
                className={`w-full md:w-[40%] flex-1 md:flex-none flex flex-col min-h-0 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 ${mobileTab === "catalog" ? "hidden md:flex" : "flex"
                    } h-full`}
            >
                <CartPanel
                    isMounted={isMounted}
                    activeBill={activeBill}
                    bills={bills}
                    activeBillId={activeBillId}
                    billSearchQuery={billSearchQuery}
                    customers={customers}
                    staffList={staffList}
                    settings={settings}
                    totals={totals}
                    submitting={submitting}
                    onSwitchBill={switchBill}
                    onAddNewBill={addNewBill}
                    onRemoveClick={handleRemoveClick}
                    onBillSearchChange={setBillSearchQuery}
                    onUpdateActiveBill={updateActiveBill}
                    onUpdateQuantity={updateQuantity}
                    onRemoveFromCart={removeFromCart}
                    onAddStaff={addStaff}
                    onRemoveStaff={removeStaff}
                    onUpdateStaffPct={updateStaffPct}
                    onCheckout={handleCheckout}
                    onCancelEdit={handleCancelEdit}
                    onOpenAddCustomerModal={openAddCustomerModal}
                />
            </div>

            {/* ── Mobile bottom nav ── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-around h-16 z-50 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setMobileTab("catalog")}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all ${mobileTab === "catalog"
                            ? "text-primary-900 dark:text-primary-400 scale-110"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                >
                    <LayoutDashboard className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Danh mục</span>
                    {mobileTab === "catalog" && (
                        <div className="absolute top-0 w-8 h-1 bg-primary-900 dark:bg-primary-500 rounded-b-full" />
                    )}
                </button>
                <div className="w-px h-8 bg-gray-100 dark:bg-slate-800" />
                <button
                    onClick={() => setMobileTab("cart")}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all relative ${mobileTab === "cart"
                            ? "text-primary-900 dark:text-primary-400 scale-110"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5 mb-1" />
                        {activeBill && activeBill.cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                {activeBill.cart.reduce(
                                    (a, b) => a + b.quantity,
                                    0
                                )}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold">Giỏ hàng</span>
                    {mobileTab === "cart" && (
                        <div className="absolute top-0 w-8 h-1 bg-primary-900 dark:bg-primary-500 rounded-b-full" />
                    )}
                </button>
            </div>

            {/* ── Delete bill modal ── */}
            {billToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Xác nhận xóa hóa đơn
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Bạn có chắc chắn muốn xóa hóa đơn này không?
                                Các sản phẩm đã chọn trong bill sẽ bị mất.
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

            {/* ── Add customer modal ── */}
            {isAddCustomerModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-slate-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Thêm khách hàng mới
                            </h3>
                            <button
                                onClick={() =>
                                    setIsAddCustomerModalOpen(false)
                                }
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                                    Tên khách hàng{" "}
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) =>
                                        setNewCustomerName(e.target.value)
                                    }
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900 bg-gray-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
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
                                    onChange={(e) =>
                                        setNewCustomerPhone(e.target.value)
                                    }
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900 bg-gray-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                                    placeholder="Nhập số điện thoại..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                                    Giới Tính
                                </label>
                                <select
                                    value={newCustomerGender}
                                    onChange={(e) =>
                                        setNewCustomerGender(e.target.value)
                                    }
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900 bg-gray-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                                >
                                    <option value="other">Không xác định</option>
                                    <option value="female">Nữ</option>
                                    <option value="male">Nam</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 w-full border-t border-gray-100 dark:border-slate-800 pt-4">
                            <button
                                onClick={() =>
                                    setIsAddCustomerModalOpen(false)
                                }
                                disabled={isSubmittingCustomer}
                                className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-bold transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                disabled={
                                    isSubmittingCustomer ||
                                    !newCustomerName.trim()
                                }
                                className="px-5 py-2.5 bg-primary-900 text-white rounded-lg hover:bg-primary-800 text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmittingCustomer ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
