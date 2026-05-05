"use client";

import { memo, useCallback, useMemo } from "react";
import { ShoppingCart, User, Plus, Edit, Wallet } from "lucide-react";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { formatCurrency } from "@/lib/currency";
import { BillTabs } from "./BillTabs";
import { CartItemRow } from "./CartItemRow";
import { SummaryPanel } from "./SummaryPanel";
import type { Bill, CartItem, Customer, StaffMember, Totals } from "../types";
import { getCartItemKey } from "../utils";

interface CartPanelProps {
    isMounted: boolean;
    activeBill: Bill | undefined;
    bills: Bill[];
    activeBillId: string;
    billSearchQuery: string;
    customers: Customer[];
    staffList: StaffMember[];
    settings: any;
    totals: Totals;
    submitting: boolean;
    onSwitchBill: (id: string) => void;
    onAddNewBill: () => void;
    onRemoveClick: (id: string, e: React.MouseEvent) => void;
    onBillSearchChange: (query: string) => void;
    onUpdateActiveBill: (
        updates: Partial<Bill> | ((prev: Bill) => Partial<Bill>)
    ) => void;
    onUpdateQuantity: (itemId: string, type: string, delta: number) => void;
    onRemoveFromCart: (itemId: string, type: string) => void;
    onAddStaff: (itemId: string, type: string, staffId: string) => void;
    onRemoveStaff: (itemId: string, type: string, staffId: string) => void;
    onUpdateStaffPct: (
        itemId: string,
        type: string,
        staffId: string,
        pct: number
    ) => void;
    onCheckout: () => void;
    onCancelEdit: () => void;
    onOpenAddCustomerModal: () => void;
}

export const CartPanel = memo(function CartPanel({
    isMounted,
    activeBill,
    bills,
    activeBillId,
    billSearchQuery,
    customers,
    staffList,
    settings,
    totals,
    submitting,
    onSwitchBill,
    onAddNewBill,
    onRemoveClick,
    onBillSearchChange,
    onUpdateActiveBill,
    onUpdateQuantity,
    onRemoveFromCart,
    onAddStaff,
    onRemoveStaff,
    onUpdateStaffPct,
    onCheckout,
    onCancelEdit,
    onOpenAddCustomerModal,
}: CartPanelProps) {
    const filteredBills = useMemo(
        () =>
            bills.filter((b) =>
                b.name
                    .toLowerCase()
                    .includes(billSearchQuery.toLowerCase())
            ),
        [bills, billSearchQuery]
    );

    const customerOptions = useMemo(
        () => [
            { value: "walking-customer", label: "Khách vãng lai" },
            ...customers.map((c) => ({
                value: c._id,
                label: `${c.name}${c.phone ? ` (${c.phone})` : ""}`,
            })),
        ],
        [customers]
    );

    const handleCustomerChange = useCallback(
        (val: string) => onUpdateActiveBill({ selectedCustomer: val }),
        [onUpdateActiveBill]
    );
    const handleBillNameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onUpdateActiveBill({ name: e.target.value }),
        [onUpdateActiveBill]
    );

    const handleWalletAmountChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>, maxWallet: number) => {
            const max = Math.min(maxWallet, totals.total);
            const val = Math.min(
                Math.max(0, parseFloat(e.target.value) || 0),
                max
            );
            onUpdateActiveBill({ walletAmountUsed: val });
        },
        [onUpdateActiveBill, totals.total]
    );

    const handleUpdateActiveBillPartial = useCallback(
        (updates: Partial<Bill>) => onUpdateActiveBill(updates),
        [onUpdateActiveBill]
    );

    const selectedCustomer = useMemo(
        () =>
            activeBill
                ? customers.find((c) => c._id === activeBill.selectedCustomer)
                : undefined,
        [activeBill, customers]
    );

    const walletBalance = selectedCustomer?.walletBalance ?? 0;

    return (
        <>
            <BillTabs
                bills={bills}
                filteredBills={filteredBills}
                activeBillId={activeBillId}
                billSearchQuery={billSearchQuery}
                onSwitchBill={onSwitchBill}
                onAddNewBill={onAddNewBill}
                onRemoveClick={onRemoveClick}
                onBillSearchChange={onBillSearchChange}
            />

            {isMounted && activeBill && (
                <div className="bg-white dark:bg-slate-900 flex flex-col flex-1 min-h-0">
                    {/* Customer & bill name section */}
                    <div className="p-3 md:p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex-shrink-0 space-y-3">
                        <div className="flex items-center gap-2">
                            <Edit className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Đặt tên Bill (VD: Bàn 1, Chị Hà VIP...)"
                                value={activeBill.name}
                                onChange={handleBillNameChange}
                                className="flex-1 px-3 py-1.5 text-sm font-bold text-primary-900 dark:text-primary-400 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                                <SearchableSelect
                                    placeholder="Chọn khách hàng"
                                    value={activeBill.selectedCustomer}
                                    onChange={handleCustomerChange}
                                    options={customerOptions}
                                    className="flex-1"
                                />
                                <button
                                    onClick={onOpenAddCustomerModal}
                                    className="p-2 bg-primary-100 text-primary-900 rounded-lg hover:bg-primary-200 transition-colors flex-shrink-0"
                                    title="Thêm khách hàng mới"
                                >
                                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            </div>

                            {/* Wallet balance row */}
                            {selectedCustomer && walletBalance > 0 && (
                                <WalletRow
                                    walletBalance={walletBalance}
                                    walletAmountUsed={activeBill.walletAmountUsed}
                                    total={totals.total}
                                    afterWalletTotal={totals.afterWalletTotal}
                                    onWalletChange={handleWalletAmountChange}
                                />
                            )}
                        </div>
                    </div>

                    {/* Cart items */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-2 md:p-3 space-y-2 pb-24 md:pb-2">
                        {activeBill.cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 py-10">
                                <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
                                <p className="text-xs md:text-sm">
                                    Giỏ hàng trống
                                </p>
                            </div>
                        ) : (
                            activeBill.cart.map((item) => (
                                <CartItemRow
                                    key={`${item.type}-${item._id}`}
                                    item={item}
                                    staffList={staffList}
                                    assignments={
                                        activeBill.serviceStaffAssignments[
                                            getCartItemKey(item._id, item.type)
                                        ] || []
                                    }
                                    currencySymbol={settings.symbol || "₫"}
                                    onUpdateQuantity={onUpdateQuantity}
                                    onRemoveFromCart={onRemoveFromCart}
                                    onAddStaff={onAddStaff}
                                    onRemoveStaff={onRemoveStaff}
                                    onUpdateStaffPct={onUpdateStaffPct}
                                />
                            ))
                        )}
                    </div>

                    {/* Summary */}
                    <SummaryPanel
                        activeBill={activeBill}
                        totals={totals}
                        staffList={staffList}
                        settings={settings}
                        submitting={submitting}
                        onCheckout={onCheckout}
                        onUpdateActiveBill={handleUpdateActiveBillPartial}
                        onCancelEdit={onCancelEdit}
                    />
                </div>
            )}
        </>
    );
});

// ─── WalletRow ────────────────────────────────────────────────────────────────

interface WalletRowProps {
    walletBalance: number;
    walletAmountUsed: number;
    total: number;
    afterWalletTotal: number;
    onWalletChange: (
        e: React.ChangeEvent<HTMLInputElement>,
        maxWallet: number
    ) => void;
}

const WalletRow = memo(function WalletRow({
    walletBalance,
    walletAmountUsed,
    total,
    afterWalletTotal,
    onWalletChange,
}: WalletRowProps) {
    const formattedBalance = useMemo(
        () => formatCurrency(walletBalance),
        [walletBalance]
    );
    const maxInput = Math.min(
        walletBalance,
        afterWalletTotal + (walletAmountUsed || 0)
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onWalletChange(e, walletBalance),
        [onWalletChange, walletBalance]
    );

    return (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-lg px-3 py-2">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-300 flex-1 font-medium">
                Số dư ví:{" "}
                <span className="font-black">{formattedBalance}</span>
            </span>
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Dùng:
                </span>
                <input
                    type="number"
                    min="0"
                    max={maxInput}
                    value={walletAmountUsed || ""}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-20 text-right text-[11px] font-black border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
            </div>
        </div>
    );
});
