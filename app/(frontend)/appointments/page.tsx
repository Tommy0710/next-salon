"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays, isSameDay, parse, addMinutes, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Plus, X, List, Edit, Trash2, Search, CheckCircle, MoreVertical, Filter, FileText, DollarSign, Eye, ArrowUpDown } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import MultiSearchableSelect from "@/components/dashboard/MultiSearchableSelect";
import StaffCalendar from "@/components/appointments/StaffCalendar";
import { formatAppointmentDateTime } from '@/lib/zaloDate';
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatCurrency } from "@/lib/currency";

interface Service {
    _id: string;
    name: string;
    duration: number;
    price: number;
    commissionType?: 'percentage' | 'fixed';
    commissionValue?: number;
}

interface Staff {
    _id: string;
    name: string;
    commissionRate: number;
}

interface Customer {
    _id: string;
    name: string;
    phone?: string;
}

interface Appointment {
    _id: string;
    customer: Customer;
    staff?: Staff;
    services: { service: Service; name: string; price: number; duration: number }[];
    date: string;
    startTime: string; // "14:00"
    endTime: string;
    totalAmount: number;
    discount: number;
    commission: number;
    status: string;
    notes?: string;
    source?: string;
    bookingCode?: string;
    createdAt?: string;
}

export default function AppointmentsPage() {
    const { settings } = useSettings();
    const [date, setDate] = useState(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'calendar' | 'list'>('list');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customerId: "",
        staffId: "",
        serviceIds: [] as string[],
        startTime: "",
        date: format(new Date(), "yyyy-MM-dd"),
        discount: 0,
        notes: "",
        status: "confirmed"
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 10, pages: 0 });
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [formError, setFormError] = useState("");
    const [itemsPerPage, setItemsPerPage] = useState(10);
    // Default sort: by appointment date, descending (newest first)
    const [sortBy, setSortBy] = useState<'appointment' | 'createdAt'>('appointment');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Slot system state
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // THÊM STATE CHO TẠO CUSTOMER NHANH
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

    // THÊM STATE CHO MODAL CHI TIẾT APPOINTMENT
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    // 👉 HÀM GỌI API ZALO TỪ FRONTEND
    const triggerZaloZNS = async (apt: Appointment | any, newStatus: string) => {
        // Chỉ gửi nếu khách hàng có số điện thoại
        if (!apt.customer?.phone) return;

        // Xác định đúng eventType để Backend map với Template ID
        let eventType = '';
        if (newStatus === 'confirmed') eventType = 'appointment_confirmed';
        else if (newStatus === 'cancelled') eventType = 'appointment_cancelled';

        if (!eventType) return;

        try {
            // Chuẩn bị payloadData khớp chính xác với cấu trúc ở lib/zalo-payloads.ts
            const payload = {
                phone: apt.customer.phone,
                eventType: eventType,
                payloadData: {
                    customerName: apt.customer?.name || "Quý khách",
                    appointmentDate: formatAppointmentDateTime(apt.date, apt.startTime),
                    bookingCode: apt.bookingCode || apt._id.substring(0, 8).toUpperCase(),
                    serviceName: apt.services?.map((s: any) => s.name).join(', ') || "Dịch vụ Spa",
                    status: newStatus === 'confirmed' ? "Đã xác nhận" : "Đã bị hủy",
                    invoiceId: apt._id
                }
            };

            // Bắn API
            const response = await fetch("/api/zalo/zns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!result.success) {
                console.error("❌ Lỗi gửi Zalo:", result.error);
            } else {
                console.log(`✅ Đã yêu cầu gửi Zalo ZNS thành công cho trạng thái: ${newStatus}`);
            }
        } catch (error) {
            console.error("❌ Lỗi hệ thống khi gọi API Zalo:", error);
        }
    };
    useEffect(() => {
        fetchResources();
    }, []);

    // Update service IDs when services are loaded, if we're editing an appointment
    useEffect(() => {
        if (editingAppointment && services.length > 0 && isModalOpen) {
            // Extract service IDs from the appointment - s.service is an ObjectId (string when serialized)
            const serviceIds = editingAppointment.services.map(s => {
                // Handle both string (from API) and object (if populated) cases
                if (typeof s.service === 'string') {
                    return s.service;
                }
                // If it's an object (populated), get the _id
                return (s.service as any)?._id || String(s.service);
            }).filter(Boolean) as string[];

            // Ensure service IDs are valid and exist in the current services list
            const validServiceIds = serviceIds.filter(id =>
                id && services.some(service => service._id === id)
            );

            // Update service IDs - this ensures they're selected once services load
            setFormData(prevFormData => ({
                ...prevFormData,
                serviceIds: validServiceIds
            }));
        }
    }, [services, editingAppointment, isModalOpen]);

    // Fetch available slots when date is selected
    useEffect(() => {
        if (formData.date && isModalOpen) {
            fetchAvailableSlots();
        } else {
            setAvailableSlots([]);
        }
    }, [formData.date, isModalOpen]);

    useEffect(() => {
        fetchAppointments();
    }, [page, statusFilter, itemsPerPage, sortBy, sortOrder]); // Re-fetch on filter change or items per page change

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchAppointments();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-trigger')) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const fetchResources = async () => {
        const [staffRes, serviceRes, customerRes] = await Promise.all([
            fetch("/api/staff?limit=999"),
            fetch("/api/services?limit=999"),
            fetch("/api/customers?limit=999")
        ]);
        const staffData = await staffRes.json();
        const serviceData = await serviceRes.json();
        const customerData = await customerRes.json();

        if (staffData.success) setStaffList(staffData.data);
        if (serviceData.success) setServices(serviceData.data);
        if (customerData.success) setCustomers(customerData.data);
    };



    const fetchAvailableSlots = async () => {
        if (!formData.date) {
            setAvailableSlots([]);
            return;
        }

        setLoadingSlots(true);
        try {
            const res = await fetch(`/api/appointments/slots?date=${formData.date}`);
            const data = await res.json();
            if (data.success) {
                const slots = data.data.map((time: string) => ({ startTime: time }));
                setAvailableSlots(slots);
            }
        } catch (error) {
            console.error(error);
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const fetchAppointments = async () => {
        setLoading(true);
        const url = `/api/appointments?page=${page}&limit=${itemsPerPage}&search=${searchTerm}&status=${statusFilter}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setAppointments(data.data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string, sendZalo: boolean = false) => {
        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus, sendZalo }),
            });
            const data = await res.json();
            if (data.success) {
                // 👉 TÌM LẠI THÔNG TIN LỊCH HẸN VÀ GỬI ZALO
                const aptToUpdate = appointments.find(a => a._id === id);
                if (aptToUpdate && (newStatus === 'confirmed' || newStatus === 'cancelled')) {
                    // Chạy ngầm không cần await để UI không bị đơ
                    triggerZaloZNS(aptToUpdate, newStatus);
                }
                fetchAppointments();
            } else {
                alert(data.error || "Failed to update status");
            }
        } catch (error) {
            console.error("Error updating status:", error);
            alert("An unexpected error occurred");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.startTime) {
            setFormError("Please select a time slot");
            return;
        }

        setIsSubmitting(true);

        try {
            // Calculate details
            const selectedServices = services.filter(s => formData.serviceIds.includes(s._id));
            const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
            const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);

            const discount = formData.discount || 0;
            const tax = subtotal * (settings.taxRate / 100);
            const totalAmount = (subtotal + tax) - discount;

            // Calculate commission
            // const staff = staffList.find(s => s._id === formData.staffId);
            // const staffRate = staff?.commissionRate || 0;

            let commission = 0;
            selectedServices.forEach(svc => {
                const commType = svc.commissionType || 'percentage';
                const commValue = svc.commissionValue !== undefined ? svc.commissionValue : /* staffRate */ 0;

                if (commType === 'percentage') {
                    const shareOfTotal = subtotal > 0 ? (totalAmount * (svc.price / subtotal)) : 0;
                    commission += (shareOfTotal * commValue) / 100;
                } else {
                    commission += commValue;
                }
            });

            // Calculate endTime
            const startDateTime = parse(formData.startTime, "HH:mm", new Date(formData.date));
            const endDateTime = addMinutes(startDateTime, totalDuration);
            const endTime = format(endDateTime, "HH:mm");

            const payload: any = {
                customer: formData.customerId,
                services: selectedServices.map(s => ({
                    service: s._id,
                    name: s.name,
                    price: s.price,
                    duration: s.duration
                })),
                date: formData.date,
                startTime: formData.startTime,
                endTime,
                totalDuration,
                totalAmount,
                discount,
                commission,
                status: formData.status,
                notes: formData.notes
            };
            if (formData.staffId) {
                payload.staff = formData.staffId;
            }

            const url = editingAppointment ? `/api/appointments/${editingAppointment._id}` : "/api/appointments";
            const method = editingAppointment ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                const updatedApt = data.data; // Lấy dữ liệu trả về từ Backend

                // 👉 GỬI ZALO NẾU TRẠNG THÁI LÀ CONFIRMED HOẶC CANCELLED
                if (updatedApt.status === 'confirmed' || updatedApt.status === 'cancelled') {
                    // Vì updatedApt trả về có thể chỉ chứa customer._id, ta cần lấy thông tin full từ state customers
                    const fullCustomer = customers.find(c => c._id === formData.customerId);

                    // Ghép thông tin khách hàng vào lịch hẹn để gửi Zalo
                    const aptForZalo = {
                        ...updatedApt,
                        customer: fullCustomer || { phone: '', name: 'Quý khách' }
                    };

                    triggerZaloZNS(aptForZalo, updatedApt.status);
                }
                fetchAppointments();
                setRefreshTrigger(prev => prev + 1);
                closeModal();
            } else {
                setFormError(data.error || "Failed to save appointment");
            }
        } catch (error) {
            console.error('Error submitting appointment:', error);
            setFormError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this appointment?")) return;
        try {
            const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchAppointments();
            }
        } catch (error) {
            console.error("Error deleting appointment:", error);
        }
    };

    const openEditModal = (apt: Appointment) => {
        setEditingAppointment(apt);
        // Extract service IDs - s.service is an ObjectId (string when serialized from API)
        const serviceIds = apt.services.map(s => {
            // Handle both string (from API) and object (if populated) cases
            if (typeof s.service === 'string') {
                return s.service;
            }
            // If it's an object (populated), get the _id
            return (s.service as any)?._id || String(s.service);
        }).filter(Boolean) as string[]; // Remove any undefined/null values

        // Only filter if services are already loaded, otherwise keep all IDs
        // This ensures services are selected even if services list hasn't loaded yet
        const validServiceIds = services.length > 0
            ? serviceIds.filter(id => services.some(service => service._id === id))
            : serviceIds;

        setFormData({
            customerId: apt.customer._id,
            staffId: apt.staff?._id || "",
            serviceIds: validServiceIds,
            startTime: apt.startTime,
            date: format(new Date(apt.date), "yyyy-MM-dd"),
            discount: (apt as any).discount || 0,
            notes: apt.notes || "",
            status: apt.status
        });
        setFormError("");
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAppointment(null);
        setFormError("");
        setFormData({
            customerId: "",
            staffId: "",
            serviceIds: [],
            startTime: "",
            date: format(new Date(), "yyyy-MM-dd"),
            discount: 0,
            notes: "",
            status: "confirmed"
        });
    };

    // HÀM TẠO CUSTOMER NHANH
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

                // 2. Tự động chọn khách hàng này cho appointment đang tạo
                setFormData(prev => ({ ...prev, customerId: data.data._id }));

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

    // HÀM MỞ MODAL CHI TIẾT APPOINTMENT
    const openDetailModal = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedAppointment(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col h-screen overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                        <button
                            onClick={() => setView('list')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'list'
                                ? "bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            List View
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${view === 'calendar'
                                ? "bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Staff Calendar
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingAppointment(null);
                        setFormData({ customerId: "", staffId: "", serviceIds: [], startTime: "", date: format(new Date(), "yyyy-MM-dd"), discount: 0, notes: "", status: "confirmed" });
                        setFormError("");
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors flex items-center gap-2 font-medium"
                >
                    <Plus className="w-4 h-4" />
                    New Appointment
                </button>
            </div>

            <div className="h-full flex-1 overflow-auto bg-white dark:bg-slate-950 flex flex-col">
                <div className="h-full p-6 space-y-6">
                    {view === 'calendar' ? (
                        <StaffCalendar
                            refreshTrigger={refreshTrigger}
                            onSelectEvent={async (event) => {
                                try {
                                    const res = await fetch(`/api/appointments/${event.id}`);
                                    const data = await res.json();
                                    if (data.success) openEditModal(data.data);
                                } catch (error) {
                                    console.error("Error opening appointment:", error);
                                }
                            }}
                        />
                    ) : (
                        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white">
                            {/* List View Filters */}
                            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 dark:bg-slate-950/50">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search by customer, booking code..."
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                                        <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none"
                                            value={statusFilter}
                                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                        >
                                            <option value="">All Statuses</option>
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => { setSearchTerm(""); setStatusFilter(""); setPage(1); }}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm px-2"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto text-black dark:text-white">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortBy('appointment'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                                                <div className="flex items-center gap-2">
                                                    <span>Appointment</span>
                                                    <ArrowUpDown className={`w-3.5 h-3.5 ${sortBy === 'appointment' ? 'text-primary-900 dark:text-primary-400' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Booking Code</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Services</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => {
                                                setSortBy('createdAt');
                                                setSortOrder(prev => sortBy === 'createdAt' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                                            }}>
                                                <div className="flex items-center gap-2">
                                                    <span>Created</span>
                                                    <ArrowUpDown className={`w-3.5 h-3.5 ${sortBy === 'createdAt' ? 'text-primary-900 dark:text-primary-400' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
                                        {loading && appointments.length === 0 ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i} className="animate-pulse">
                                                    <td colSpan={9} className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded"></div></td>
                                                </tr>
                                            ))
                                        ) : appointments.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-slate-500">
                                                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p>No appointments found</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            appointments.map((apt) => (
                                                <tr key={apt._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                                                <Clock className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{format(new Date(apt.date), "dd MMM yyyy")}</span>
                                                                <div className="text-[10px] text-gray-400 font-medium uppercase">{apt.startTime} - {apt.endTime}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm font-mono font-bold text-primary-900 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                                                            {apt.bookingCode || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{apt.customer?.name}</div>
                                                        {apt.customer?.phone && <div className="text-[10px] text-gray-500 dark:text-gray-400">{apt.customer.phone}</div>}
                                                    </td>
                                                    {/* <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                                            {apt.staff.name}
                                                        </div>
                                                    </td> */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-2 max-w-xs">
                                                            <div className="flex flex-wrap gap-1 overflow-hidden">
                                                                {apt.services.slice(0, 2).map((s, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-800/30 truncate max-w-[160px]" title={s.name}>
                                                                        {s.name}
                                                                    </span>
                                                                ))}
                                                                {apt.services.length > 2 && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                        +{apt.services.length - 2} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                {apt.services.length} service{apt.services.length > 1 ? 's' : ''}, {apt.services.reduce((sum, s) => sum + s.duration, 0)} min
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(apt.totalAmount)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{apt.source || 'Direct'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${apt.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            apt.status === 'completed' ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800' :
                                                                apt.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                                                            }`}>
                                                            {apt.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                        {format(new Date(apt.createdAt || apt.date), "dd MMM yyyy HH:mm")}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                        <div className="relative flex justify-end dropdown-trigger">
                                                            <button
                                                                onClick={() => setActiveDropdown(activeDropdown === apt._id ? null : apt._id)}
                                                                className="p-2 text-gray-400 hover:text-primary-900 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                                                            >
                                                                <MoreVertical className="w-5 h-5" />
                                                            </button>

                                                            {activeDropdown === apt._id && (
                                                                <div className="absolute right-0 mt-10 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                                    <button
                                                                        onClick={() => {
                                                                            openDetailModal(apt);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                        Xem thông tin
                                                                    </button>
                                                                    {apt.status !== 'completed' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusUpdate(apt._id, 'completed');
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <CheckCircle className="w-4 h-4" />
                                                                            Complete
                                                                        </button>
                                                                    )}
                                                                    {apt.status === 'pending' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusUpdate(apt._id, 'confirmed', true);
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <CheckCircle className="w-4 h-4" />
                                                                            Confirm
                                                                        </button>
                                                                    )}
                                                                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                handleStatusUpdate(apt._id, 'cancelled', true);
                                                                                setActiveDropdown(null);
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                            Cancel
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => {
                                                                            openEditModal(apt);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        <Edit className="w-4 h-4 text-primary-600 dark:text-primary-500" />
                                                                        Edit Details
                                                                    </button>
                                                                    <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDelete(apt._id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* List View Pagination */}
                            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Showing <span className="text-gray-900 dark:text-white">{appointments.length}</span> of <span className="text-gray-900 dark:text-white">{pagination.total}</span> appointments
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(parseInt(e.target.value));
                                            setPage(1);
                                        }}
                                        className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                                    >
                                        <option value="10">10 per page</option>
                                        <option value="25">25 per page</option>
                                        <option value="50">50 per page</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => page > 1 && setPage(page - 1)}
                                        disabled={page <= 1}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                            let pageNum;
                                            if (pagination.pages <= 5) {
                                                pageNum = i + 1;
                                            } else if (pagination.page <= 3) {
                                                pageNum = i + 1;
                                            } else if (pagination.page >= pagination.pages - 2) {
                                                pageNum = pagination.pages - 4 + i;
                                            } else {
                                                pageNum = pagination.page - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPage(pageNum)}
                                                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === pageNum
                                                        ? "bg-primary-900 dark:bg-primary-700 text-white"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => page < pagination.pages && setPage(page + 1)}
                                        disabled={page >= pagination.pages}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAppointment ? "Edit Appointment" : "New Appointment"}>
                <form onSubmit={handleSubmit}>
                    {formError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                            {formError}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                        <FormInput label="Giảm giá (%)" type="number" min="0" max="100" value={formData.discount?.toString() || "0"} onChange={(e) => {
                            let val = parseFloat(e.target.value) || 0;
                            if (val > 100) val = 100;
                            setFormData({ ...formData, discount: val });
                        }} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                        {/* Customer */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Customer<span className="text-red-500 ml-1">*</span>
                            </label>

                            <div className="flex items-center gap-2">
                                <SearchableSelect
                                    placeholder="Select Customer"
                                    className="flex-1 min-w-0"
                                    value={formData.customerId}
                                    onChange={(value) => setFormData({ ...formData, customerId: value })}
                                    options={customers.map(c => ({
                                        value: c._id,
                                        label: `${c.name} (${c.phone || 'No phone'})`
                                    }))}
                                />

                                <button
                                    type="button"
                                    onClick={() => setIsAddCustomerModalOpen(true)}
                                    className="p-3 bg-primary-100 text-primary-900 rounded-lg hover:bg-primary-200 transition-colors flex-shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Staff */}
                        <SearchableSelect
                            label="Staff (Optional)"
                            placeholder="Select Staff"
                            value={formData.staffId}
                            onChange={(value) => setFormData({ ...formData, staffId: value })}
                            options={staffList.map(s => ({ value: s._id, label: s.name }))}
                        />

                    </div>

                    <MultiSearchableSelect
                        label="Services"
                        placeholder="Select Services"
                        required
                        value={formData.serviceIds}
                        onChange={(values) => setFormData({ ...formData, serviceIds: values })}
                        options={services.map(s => ({ value: s._id, label: `${s.name} (${formatCurrency(s.price)})` }))}
                        key={`service-select-${editingAppointment?._id || 'new'}`}
                    />

                    <div className="mt-6">
                        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                            Select Available Time Slot
                            {formData.date && loadingSlots && (
                                <span className="text-xs font-normal text-gray-400 animate-pulse ml-2">(Updating slots...)</span>
                            )}
                        </label>

                        {formData.date ? (
                            availableSlots.length > 0 ? (
                                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2 p-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                                    {availableSlots.map((slot, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, startTime: slot.startTime })}
                                            className={`px-3 py-2.5 text-xs font-bold rounded-lg border transition-all duration-200 ${formData.startTime === slot.startTime
                                                ? "bg-primary-900 dark:bg-primary-700 text-white border-primary-900 dark:border-primary-700 shadow-lg scale-105"
                                                : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-800"
                                                }`}
                                        >
                                            {slot.startTime}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-950/50 text-sm text-gray-500 dark:text-gray-400 text-center">
                                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    {loadingSlots ? "Loading available spots..." : "No available slots for this date."}
                                </div>
                            )
                        ) : (
                            <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-950/50 text-sm text-gray-500 dark:text-gray-400 text-center">
                                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                Please select date to view availability
                            </div>
                        )}
                    </div>

                    <div className="mt-6 p-4 bg-gradient-to-br from-primary-900 to-indigo-900 rounded-2xl text-white shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-primary-100 text-[10px] font-bold uppercase tracking-wider">Estimated Duration</p>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary-300" />
                                    <span className="text-xl font-bold">
                                        {services.filter(s => formData.serviceIds.includes(s._id)).reduce((a, b) => a + b.duration, 0)} min
                                    </span>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-white/20" />
                            <div className="text-right space-y-1">
                                <p className="text-primary-100 text-[10px] font-bold uppercase tracking-wider">Total Amount</p>
                                <div className="flex items-center justify-end gap-2">
                                    <DollarSign className="w-5 h-5 text-emerald-400" />
                                    <span className="text-2xl font-black">
                                        {(() => {
                                            const subtotal = services.filter(s => formData.serviceIds.includes(s._id)).reduce((a, b) => a + b.price, 0);
                                            const tax = subtotal * (settings.taxRate / 100);
                                            const discountAmount = subtotal * ((formData.discount || 0) / 100);
                                            return formatCurrency((subtotal + tax) - discountAmount);
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <FormSelect
                            label="Status"
                            value={formData.status}
                            onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                            options={[
                                { value: "pending", label: "Pending" },
                                { value: "confirmed", label: "Confirmed" },
                                { value: "completed", label: "Completed" },
                                { value: "cancelled", label: "Cancelled" },
                            ]}
                        />
                        <FormInput label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800" disabled={isSubmitting}>Cancel</button>
                        <FormButton type="submit" loading={isSubmitting}>
                            {editingAppointment ? "Update Appointment" : "Book Appointment"}
                        </FormButton>
                    </div>
                </form>
            </Modal>

            {/* THÊM VÀO ĐÂY: Modal Tạo Khách Hàng Nhanh */}
            {isAddCustomerModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Thêm Khách Hàng Mới</h3>
                            <button
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-2">Tên Khách Hàng <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                                    placeholder="Nhập tên khách hàng"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-300 mb-2">Số Điện Thoại <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    value={newCustomerPhone}
                                    required
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                                    placeholder="Nhập số điện thoại"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                                disabled={isSubmittingCustomer}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateCustomer}
                                disabled={isSubmittingCustomer}
                                className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingCustomer ? "Đang tạo..." : "Tạo Khách Hàng"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHI TIẾT APPOINTMENT */}
            {isDetailModalOpen && selectedAppointment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 border border-transparent dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Chi tiết Appointment</h3>
                            <button
                                onClick={closeDetailModal}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Thông tin cơ bản */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Ngày</label>
                                    <p className="text-sm text-gray-900 dark:text-white">{format(new Date(selectedAppointment.date), "dd/MM/yyyy")}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Thời gian</label>
                                    <p className="text-sm text-gray-900 dark:text-white">{selectedAppointment.startTime} - {selectedAppointment.endTime}</p>
                                </div>
                            </div>

                            {/* Booking Code */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Booking Code</label>
                                <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg">
                                    <p className="text-lg font-mono font-bold text-primary-900 dark:text-primary-400">{selectedAppointment.bookingCode || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Khách hàng */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Khách hàng</label>
                                <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-transparent dark:border-slate-700">
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedAppointment.customer.name}</p>
                                    {selectedAppointment.customer.phone && <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAppointment.customer.phone}</p>}
                                </div>
                            </div>

                            {/* Staff (nếu có) */}
                            {selectedAppointment.staff && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Staff</label>
                                    <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-transparent dark:border-slate-700">
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedAppointment.staff.name}</p>
                                    </div>
                                </div>
                            )}

                            {/* Dịch vụ */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dịch vụ</label>
                                <div className="space-y-2">
                                    {selectedAppointment.services.map((service, idx) => (
                                        <div key={idx} className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-transparent dark:border-slate-700">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{service.name}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{service.duration} phút</p>
                                            </div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{settings.symbol}{service.price.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Thông tin tài chính */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tổng tiền</label>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{settings.symbol}{selectedAppointment.totalAmount.toFixed(2)}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Giảm giá</label>
                                    <p className="text-sm text-gray-900 dark:text-white">{settings.symbol}{(selectedAppointment as any).discount?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>

                            {/* Commission */}
                            {(selectedAppointment as any).commission > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Commission</label>
                                    <p className="text-sm text-gray-900 dark:text-white">{settings.symbol}{(selectedAppointment as any).commission?.toFixed(2) || '0.00'}</p>
                                </div>
                            )}

                            {/* Status và Source */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Trạng thái</label>
                                    <span className={`text-sm uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${selectedAppointment.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                                        selectedAppointment.status === 'completed' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800' :
                                            selectedAppointment.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                                        }`}>
                                        {selectedAppointment.status}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nguồn</label>
                                    <p className="text-sm text-gray-900 dark:text-white capitalize">{selectedAppointment.source || 'Direct'}</p>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedAppointment.notes && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ghi chú</label>
                                    <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-transparent dark:border-slate-700">
                                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedAppointment.notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                type="button"
                                onClick={closeDetailModal}
                                className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
