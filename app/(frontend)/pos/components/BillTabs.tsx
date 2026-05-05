"use client";

import { memo, useCallback } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import type { Bill } from "../types";

interface BillTabsProps {
    bills: Bill[];
    filteredBills: Bill[];
    activeBillId: string;
    billSearchQuery: string;
    onSwitchBill: (id: string) => void;
    onAddNewBill: () => void;
    onRemoveClick: (id: string, e: React.MouseEvent) => void;
    onBillSearchChange: (query: string) => void;
}

export const BillTabs = memo(function BillTabs({
    bills,
    filteredBills,
    activeBillId,
    billSearchQuery,
    onSwitchBill,
    onAddNewBill,
    onRemoveClick,
    onBillSearchChange,
}: BillTabsProps) {
    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onBillSearchChange(e.target.value),
        [onBillSearchChange]
    );

    return (
        <>
            {/* Search bar + new bill button */}
            <div className="p-2 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex items-center gap-2 flex-shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                        type="text"
                        placeholder="Tìm tên bill..."
                        value={billSearchQuery}
                        onChange={handleSearchChange}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-primary-900"
                    />
                </div>
                <button
                    onClick={onAddNewBill}
                    className="flex items-center justify-center p-1.5 bg-primary-900 text-white hover:bg-primary-800 rounded-md shadow-sm transition-colors"
                    title="Tạo Bill Mới"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Bill tabs */}
            <div className="flex overflow-x-auto bg-gray-100 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 hide-scrollbar p-1 flex-shrink-0">
                {filteredBills.map((bill) => (
                    <BillTab
                        key={bill.id}
                        bill={bill}
                        isActive={bill.id === activeBillId}
                        showRemove={bills.length > 1}
                        onSwitch={onSwitchBill}
                        onRemove={onRemoveClick}
                    />
                ))}
            </div>
        </>
    );
});

// ─── Individual tab ───────────────────────────────────────────────────────────

interface BillTabProps {
    bill: Bill;
    isActive: boolean;
    showRemove: boolean;
    onSwitch: (id: string) => void;
    onRemove: (id: string, e: React.MouseEvent) => void;
}

const BillTab = memo(function BillTab({
    bill,
    isActive,
    showRemove,
    onSwitch,
    onRemove,
}: BillTabProps) {
    const handleClick = useCallback(() => onSwitch(bill.id), [bill.id, onSwitch]);
    const handleRemove = useCallback(
        (e: React.MouseEvent) => onRemove(bill.id, e),
        [bill.id, onRemove]
    );

    return (
        <div
            onClick={handleClick}
            className={`flex items-center gap-2 px-3 py-1.5 min-w-[100px] cursor-pointer rounded-t-md text-xs font-semibold border-b-2 transition-colors ${
                isActive
                    ? "bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 border-primary-900 dark:border-primary-500 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-slate-800"
            }`}
        >
            <span className="nowrap flex-1">{bill.name}</span>
            {showRemove && (
                <button
                    onClick={handleRemove}
                    className="text-gray-400 hover:text-red-500 p-0.5"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </div>
    );
});
