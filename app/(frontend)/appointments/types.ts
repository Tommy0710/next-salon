export interface Service {
  _id: string;
  name: string;
  duration: number;
  price: number;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
}

export interface Staff {
  _id: string;
  name: string;
  commissionRate: number;
}

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
}

export interface ServiceEntry {
  service: Service | string;
  name: string;
  price: number;
  duration: number;
}

export interface Appointment {
  _id: string;
  customer: Customer;
  staff?: Staff;
  services: ServiceEntry[];
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  discount: { type: 'percentage' | 'fixed'; value: number };
  commission: number;
  status: string;
  notes?: string;
  source?: string;
  bookingCode?: string;
  createdAt?: string;
  reminderCount?: number;
}

export interface AppointmentFormData {
  customerId: string;
  staffId: string;
  serviceIds: string[];
  startTime: string;
  date: string;
  discount: { type: 'percentage' | 'fixed'; value: number };
  notes: string;
  status: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AppointmentFinancials {
  subtotal: number;
  totalDuration: number;
  totalAmount: number;
  commission: number;
  discountAmount: number;
}
