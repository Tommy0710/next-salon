"use client";

import { memo, useCallback, useMemo } from "react";
import { CreditCard, Wallet, X } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { formatCurrency } from "@/lib/currency";
import type { Bill, Totals, StaffMember } from "../types";

interface SummaryPanelProps {
    activeBill: Bill;
    totals: Totals;
    staffList: StaffMember[];
    settings: any;
    submitting: boolean;
    onCheckout: () => void;
    onUpdateActiveBill: (updates: Partial<Bill>) => void;
    onCancelEdit: () => void;
}

export const SummaryPanel = memo(function SummaryPanel({
    activeBill,
    totals,
    staffList,
    settings,
    submitting,
    onCheckout,
    onUpdateActiveBill,
    onCancelEdit,
}: SummaryPanelProps) {
    const {
        subtotal,
        commission,
        assignments,
        discountAmount,
        walletUsed,
        afterWalletTotal,
    } = totals;

    // Pre-format currency values to avoid calling formatCurrency in render loops
    const fmt = useMemo(
        () => ({
            subtotal: formatCurrency(subtotal),
            commission: formatCurrency(commission),
            discountAmount: formatCurrency(discountAmount),
            walletUsed: formatCurrency(walletUsed),
            afterWalletTotal: formatCurrency(afterWalletTotal),
        }),
        [subtotal, commission, discountAmount, walletUsed, afterWalletTotal]
    );

    const formattedAssignments = useMemo(
        () =>
            assignments.map((a) => ({
                ...a,
                staffName:
                    staffList.find((s) => s._id === a.staffId)?.name || "",
                formattedCommission: formatCurrency(a.commission || 0),
            })),
        [assignments, staffList]
    );

    const paid =
        activeBill.amountPaid === ""
            ? 0
            : parseFloat(activeBill.amountPaid.toString());
    const hasDebt = activeBill.amountPaid !== "" && paid < afterWalletTotal;
    const debtAmount = hasDebt ? formatCurrency(afterWalletTotal - paid) : null;

    const handleDiscountTypePercentage = useCallback(
        () => onUpdateActiveBill({ discountType: "percentage", discount: 0 }),
        [onUpdateActiveBill]
    );
    const handleDiscountTypeFixed = useCallback(
        () => onUpdateActiveBill({ discountType: "fixed", discount: 0 }),
        [onUpdateActiveBill]
    );
    const handleDiscountChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            let val = parseFloat(e.target.value) || 0;
            if (
                (activeBill.discountType ?? "percentage") === "percentage" &&
                val > 100
            )
                val = 100;
            onUpdateActiveBill({ discount: val });
        },
        [activeBill.discountType, onUpdateActiveBill]
    );
    const handleAmountPaidChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onUpdateActiveBill({ amountPaid: e.target.value }),
        [onUpdateActiveBill]
    );
    const handlePaymentMethod = useCallback(
        (method: string) => onUpdateActiveBill({ paymentMethod: method }),
        [onUpdateActiveBill]
    );
    const handleQrIndexChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) =>
            onUpdateActiveBill({ selectedQrIndex: parseInt(e.target.value) }),
        [onUpdateActiveBill]
    );

    return (
        <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 overflow-y-auto max-h-[50vh] md:max-h-[45%] pb-20 md:pb-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {/* Totals */}
            <div className="space-y-1 mb-3 text-[10px] md:text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tổng phụ</span>
                    <span>{fmt.subtotal}</span>
                </div>

                {commission > 0 && (
                    <div className="space-y-1 bg-indigo-50 dark:bg-indigo-900/10 px-2 py-1.5 rounded border border-indigo-100/50 dark:border-indigo-900/30">
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold mb-1 border-b border-indigo-200/50 dark:border-indigo-900/50 pb-0.5">
                            <span>Tổng hoa hồng</span>
                            <span>{fmt.commission}</span>
                        </div>
                        {formattedAssignments.map((a, idx) => (
                            <div
                                key={idx}
                                className="flex justify-between text-[9px] text-indigo-500 dark:text-indigo-300 font-medium pl-1"
                            >
                                <span className="truncate pr-2">
                                    {a.staffName}
                                </span>
                                <span className="flex-shrink-0">
                                    {a.formattedCommission}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Discount */}
                <div className="flex justify-between text-gray-600 dark:text-gray-400 items-center border-t border-gray-100 dark:border-slate-800 pt-1 mt-1">
                    <div className="flex flex-col">
                        <span>Giảm giá</span>
                        {activeBill.discount > 0 && (
                            <span className="text-[9px] font-bold text-red-500">
                                -{fmt.discountAmount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex rounded overflow-hidden border border-gray-300 dark:border-slate-700 text-[10px] font-bold">
                            <button
                                onClick={handleDiscountTypePercentage}
                                className={`px-1.5 py-0.5 transition-colors ${(activeBill.discountType ?? "percentage") ===
                                    "percentage"
                                    ? "bg-primary-900 text-white"
                                    : "bg-white dark:bg-slate-950 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                %
                            </button>
                            <button
                                onClick={handleDiscountTypeFixed}
                                className={`px-1.5 py-0.5 transition-colors ${activeBill.discountType === "fixed"
                                    ? "bg-primary-900 text-white"
                                    : "bg-white dark:bg-slate-950 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                    }`}
                            >
                                ₫
                            </button>
                        </div>
                        <input
                            type="number"
                            value={activeBill.discount || ""}
                            onChange={handleDiscountChange}
                            className="w-16 text-right text-[10px] md:text-xs border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-900 outline-none"
                            min="0"
                            max={
                                activeBill.discountType === "percentage"
                                    ? 100
                                    : undefined
                            }
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Wallet used */}
                {walletUsed > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 border-t border-gray-100 dark:border-slate-800 pt-1 mt-1">
                        <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Ví sử dụng
                        </span>
                        <span className="font-bold">-{fmt.walletUsed}</span>
                    </div>
                )}

                {/* Amount paid */}
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-slate-800 pt-1.5 mt-1">
                    <span className="text-[10px] font-bold">Đã thanh toán</span>
                    <input
                        type="number"
                        placeholder={fmt.afterWalletTotal}
                        value={activeBill.amountPaid}
                        onChange={handleAmountPaidChange}
                        className="w-20 text-right text-[10px] md:text-xs border-2 border-primary-900/20 dark:border-primary-900/50 rounded px-1 py-0.5 focus:border-primary-900 bg-white dark:bg-slate-950 text-gray-900 dark:text-white outline-none font-bold"
                    />
                </div>

                {/* Total row */}
                <div className="flex justify-between text-sm md:text-base font-black text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-slate-800">
                    <span>{hasDebt ? "Còn nợ" : "Tổng cộng"}</span>
                    <span
                        className={
                            hasDebt
                                ? "text-red-600 dark:text-red-400"
                                : "text-primary-900 dark:text-primary-400"
                        }
                    >
                        {hasDebt ? debtAmount : fmt.afterWalletTotal}
                    </span>
                </div>
            </div>

            {/* Payment method */}
            <div className="mb-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                    {(["Tiền mặt", "Mã QR", "Cà thẻ"] as const).map(
                        (method) => (
                            <PaymentMethodButton
                                key={method}
                                method={method}
                                isActive={activeBill.paymentMethod === method}
                                onClick={handlePaymentMethod}
                            />
                        )
                    )}
                </div>

                {activeBill.paymentMethod === "Mã QR" &&
                    settings?.qrCodes?.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 block">
                                Chọn mã QR hiển thị:
                            </label>
                            <select
                                value={activeBill.selectedQrIndex}
                                onChange={handleQrIndexChange}
                                className="w-full p-2 text-xs border border-primary-200 dark:border-primary-900/50 rounded-lg focus:ring-1 focus:ring-primary-900 bg-primary-50/50 dark:bg-primary-900/10 text-gray-900 dark:text-white outline-none font-medium"
                            >
                                {settings.qrCodes.map(
                                    (qr: any, idx: number) => (
                                        <option
                                            key={idx}
                                            value={idx}
                                            className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                        >
                                            {qr.name} - {qr.bankName}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>
                    )}
            </div>

            {/* Action buttons */}
            <div className="w-full mb-3 flex items-stretch gap-2">
                {activeBill.editInvoiceId && (
                    <button
                        onClick={onCancelEdit}
                        className="flex-[3] flex items-center justify-center gap-1 px-2 py-4 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Hủy
                    </button>
                )}
                <FormButton
                    onClick={onCheckout}
                    loading={submitting}
                    variant="success"
                    className="w-full flex-[7] py-4 text-xs uppercase tracking-widest font-black shadow-md hover:shadow-lg active:translate-y-0.5 transition-all"
                    icon={<CreditCard className="w-4 h-4" />}
                >
                    {activeBill.editInvoiceId
                        ? "Lưu chỉnh sửa"
                        : "Hoàn thành đơn hàng"}
                </FormButton>
            </div>
        </div>
    );
});

// ─── PaymentMethodButton ──────────────────────────────────────────────────────

const PaymentMethodButton = memo(function PaymentMethodButton({
    method,
    isActive,
    onClick,
}: {
    method: string;
    isActive: boolean;
    onClick: (method: string) => void;
}) {
    const handleClick = useCallback(() => onClick(method), [method, onClick]);
    return (
        <button
            onClick={handleClick}
            className={`py-2 text-[11px] md:text-xs uppercase tracking-wider font-bold rounded-lg border transition-all ${isActive
                ? "bg-primary-900 text-white border-primary-900 shadow-sm"
                : "bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                }`}
        >
            {method}
        </button>
    );
});
