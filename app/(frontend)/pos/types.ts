export interface Item {
    _id: string;
    name: string;
    price: number;
    type: "Service" | "Product";
    productType?: "PRODUCT" | "PRE_AMOUNT";
    duration?: number;
    stock?: number;
    image?: string;
    commissionType?: "percentage" | "fixed";
    commissionValue?: number;
}

export interface StaffMember {
    _id: string;
    name: string;
    commissionRate: number;
}

export interface CartItem extends Item {
    quantity: number;
}

export interface Customer {
    _id: string;
    name: string;
    phone?: string;
    walletBalance?: number;
}

export interface StaffAssignment {
    staffId: string;
    percentage: number;
}

export interface Bill {
    id: string;
    name: string;
    cart: CartItem[];
    selectedCustomer: string;
    serviceStaffAssignments: Record<string, StaffAssignment[]>;
    discount: number;
    discountType: "percentage" | "fixed";
    paymentMethod: string;
    selectedQrIndex: number;
    amountPaid: number | string;
    walletAmountUsed: number;
    editInvoiceId?: string;
}

export interface Totals {
    subtotal: number;
    tax: number;
    total: number;
    discountAmount: number;
    commission: number;
    assignments: { staffId: string; percentage: number; commission: number }[];
    walletUsed: number;
    afterWalletTotal: number;
}
