"use client";

import { memo, useCallback, useMemo } from "react";
import {
    Minus,
    Plus,
    Trash2,
    Scissors as ScissorsIcon,
    Package,
    Wallet,
} from "lucide-react";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import type { CartItem, StaffMember, StaffAssignment } from "../types";
import { getCartItemKey } from "../utils";

interface CartItemRowProps {
    item: CartItem;
    staffList: StaffMember[];
    assignments: StaffAssignment[];
    currencySymbol: string;
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
}

export const CartItemRow = memo(function CartItemRow({
    item,
    staffList,
    assignments,
    currencySymbol,
    onUpdateQuantity,
    onRemoveFromCart,
    onAddStaff,
    onRemoveStaff,
    onUpdateStaffPct,
}: CartItemRowProps) {
    const handleIncrement = useCallback(
        () => onUpdateQuantity(item._id, item.type, 1),
        [item._id, item.type, onUpdateQuantity]
    );
    const handleDecrement = useCallback(
        () => onUpdateQuantity(item._id, item.type, -1),
        [item._id, item.type, onUpdateQuantity]
    );
    const handleRemove = useCallback(
        () => onRemoveFromCart(item._id, item.type),
        [item._id, item.type, onRemoveFromCart]
    );
    const handleAddStaff = useCallback(
        (staffId: string) => onAddStaff(item._id, item.type, staffId),
        [item._id, item.type, onAddStaff]
    );

    const staffOptions = useMemo(
        () => staffList.map((s) => ({ value: s._id, label: s.name })),
        [staffList]
    );

    const cartKey = getCartItemKey(item._id, item.type);

    return (
        <div className="p-2 border border-gray-100 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <div className="flex-shrink-0">
                        {item.type === "Service" ? (
                            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                                <ScissorsIcon className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                            </div>
                        ) : item.productType === "PRE_AMOUNT" ? (
                            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                <Wallet className="w-3 h-3 text-green-600 dark:text-green-400" />
                            </div>
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                <Package className="w-3 h-3 text-green-600 dark:text-green-400" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] md:text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {item.name}
                        </p>
                        <div className="flex items-center gap-1">
                            <p className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400">
                                {currencySymbol}{item.price}
                            </p>
                            {item.productType === "PRE_AMOUNT" && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[8px] font-black rounded uppercase">
                                    Nạp ví
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={handleDecrement}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-600 dark:text-gray-400"
                    >
                        <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    </button>
                    <span className="text-[10px] md:text-xs font-bold w-4 text-center dark:text-white">
                        {item.quantity}
                    </span>
                    <button
                        onClick={handleIncrement}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-600 dark:text-gray-400"
                    >
                        <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    </button>
                    <button
                        onClick={handleRemove}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded ml-0.5"
                    >
                        <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    </button>
                </div>
            </div>

            {item.type === "Service" && (
                <div className="pl-8 space-y-1.5">
                    <SearchableSelect
                        placeholder="Phân công nhân viên"
                        value=""
                        onChange={handleAddStaff}
                        options={staffOptions}
                        className="w-full h-8"
                    />
                    {assignments.length > 0 && (
                        <div className="space-y-1">
                            {assignments.map((assignment) => (
                                <StaffAssignmentRow
                                    key={assignment.staffId}
                                    assignment={assignment}
                                    staffList={staffList}
                                    itemId={item._id}
                                    itemType={item.type}
                                    cartKey={cartKey}
                                    onRemoveStaff={onRemoveStaff}
                                    onUpdateStaffPct={onUpdateStaffPct}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ─── StaffAssignmentRow ───────────────────────────────────────────────────────

interface StaffAssignmentRowProps {
    assignment: { staffId: string; percentage: number };
    staffList: StaffMember[];
    itemId: string;
    itemType: string;
    cartKey: string;
    onRemoveStaff: (itemId: string, type: string, staffId: string) => void;
    onUpdateStaffPct: (
        itemId: string,
        type: string,
        staffId: string,
        pct: number
    ) => void;
}

const StaffAssignmentRow = memo(function StaffAssignmentRow({
    assignment,
    staffList,
    itemId,
    itemType,
    onRemoveStaff,
    onUpdateStaffPct,
}: StaffAssignmentRowProps) {
    const staff = useMemo(
        () => staffList.find((s) => s._id === assignment.staffId),
        [staffList, assignment.staffId]
    );

    const handleRemove = useCallback(
        () => onRemoveStaff(itemId, itemType, assignment.staffId),
        [itemId, itemType, assignment.staffId, onRemoveStaff]
    );

    const handlePctChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onUpdateStaffPct(
                itemId,
                itemType,
                assignment.staffId,
                parseFloat(e.target.value) || 0
            ),
        [itemId, itemType, assignment.staffId, onUpdateStaffPct]
    );

    return (
        <div className="flex items-center gap-1.5 bg-primary-50 p-1 rounded border border-primary-100">
            <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">
                {staff?.name}
            </p>
            <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-primary-200">
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={assignment.percentage}
                    onChange={handlePctChange}
                    className="w-6 text-right text-[9px] font-black focus:outline-none"
                />
                <span className="text-[9px] font-bold text-primary-900">%</span>
            </div>
            <button
                onClick={handleRemove}
                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
            >
                <Trash2 className="w-2.5 h-2.5" />
            </button>
        </div>
    );
});
