
// This file ensures all Mongoose models are imported and registered
// Import this in API routes that use populate() to avoid MissingSchemaError

import Supplier from '@/models/Supplier';
import Customer from '@/models/Customer';
import Settings from '@/models/Settings';
import User from '@/models/User';
import Role from '@/models/Role';
import ServiceCategory from '@/models/ServiceCategory';
import Service from '@/models/Service';
import Staff from '@/models/Staff';
import Appointment from '@/models/Appointment';
import Product from '@/models/Product';
import Expense from '@/models/Expense';
import Invoice from '@/models/Invoice';
import Purchase from '@/models/Purchase';
import UsageLog from '@/models/UsageLog';
import Payroll from '@/models/Payroll';
import Deposit from '@/models/Deposit';
import StaffSlot from '@/models/StaffSlot';
import PurchaseDeposit from '@/models/PurchaseDeposit';
import ActivityLog from '@/models/ActivityLog';
import ZaloLog from '@/models/ZaloLog';

// Export all models for convenience
export {
    Supplier,
    Customer,
    Settings,
    User,
    Role,
    ServiceCategory,
    Service,
    Staff,
    Appointment,
    Product,
    Expense,
    Invoice,
    Payroll,
    Deposit,
    Purchase,
    UsageLog,
    StaffSlot,
    PurchaseDeposit,
    ActivityLog,
    ZaloLog
};

// This function can be called to ensure models are loaded
export function initModels() {
    // Models are loaded via imports above
    return {
        Supplier,
        Customer,
        Settings,
        User,
        Role,
        ServiceCategory,
        Service,
        Staff,
        Appointment,
        Product,
        Expense,
        Invoice,
        Payroll,
        Deposit,
        Purchase,
        UsageLog,
        StaffSlot,
        PurchaseDeposit,
        ActivityLog
    };
}
