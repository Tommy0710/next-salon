import type { Bill, Totals, Customer } from "./types";

export const getCartItemKey = (itemId: string, type: string): string =>
    `${type}:${itemId}`;

export const createEmptyBill = (): Bill => {
    const id = Date.now().toString();
    return {
        id,
        name: `Bill #${id.slice(-4)}`,
        cart: [],
        selectedCustomer: "",
        serviceStaffAssignments: {},
        discount: 0,
        discountType: "percentage",
        paymentMethod: "Tiền mặt",
        selectedQrIndex: 0,
        amountPaid: "",
        walletAmountUsed: 0,
        editInvoiceId: undefined,
    };
};

export const EMPTY_TOTALS: Totals = {
    subtotal: 0,
    tax: 0,
    total: 0,
    discountAmount: 0,
    commission: 0,
    assignments: [],
    walletUsed: 0,
    afterWalletTotal: 0,
};

export function computeTotals(
    bill: Bill,
    customers: Customer[],
    taxRate: number
): Totals {
    if (!bill || bill.cart.length === 0) return EMPTY_TOTALS;

    const subtotal = bill.cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const tax = subtotal * (taxRate / 100);
    const discountAmount =
        bill.discountType === "fixed"
            ? Math.min(bill.discount || 0, subtotal)
            : subtotal * ((bill.discount || 0) / 100);
    const total = subtotal + tax - discountAmount;
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    const customer = customers.find((c) => c._id === bill.selectedCustomer);
    const walletUsed =
        bill.selectedCustomer && bill.selectedCustomer !== "walking-customer"
            ? Math.min(
                  bill.walletAmountUsed || 0,
                  customer?.walletBalance || 0,
                  Math.max(0, total)
              )
            : 0;
    const afterWalletTotal = Math.max(0, total - walletUsed);

    let commission = 0;
    let serviceNetBase = 0;
    const perStaff: Record<string, { staffId: string; commission: number }> = {};

    for (const item of bill.cart) {
        if (item.type !== "Service") continue;
        const itemTotal = item.price * item.quantity;
        const serviceNet =
            subtotal > 0 ? (subtotalAfterDiscount * itemTotal) / subtotal : 0;
        serviceNetBase += serviceNet;

        const key = getCartItemKey(item._id, item.type);
        for (const a of bill.serviceStaffAssignments[key] || []) {
            const pct = Number(a.percentage) || 0;
            if (pct <= 0) continue;
            const staffComm = (serviceNet * pct) / 100;
            commission += staffComm;
            if (!perStaff[a.staffId])
                perStaff[a.staffId] = { staffId: a.staffId, commission: 0 };
            perStaff[a.staffId].commission += staffComm;
        }
    }

    const assignments = Object.values(perStaff).map((a) => ({
        staffId: a.staffId,
        percentage: serviceNetBase > 0 ? (a.commission / serviceNetBase) * 100 : 0,
        commission: a.commission,
    }));

    return {
        subtotal,
        tax,
        total,
        discountAmount,
        commission,
        assignments,
        walletUsed,
        afterWalletTotal,
    };
}
