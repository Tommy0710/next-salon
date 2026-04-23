"use client";

import { useState, useEffect } from "react";
import { format, parse, addMinutes } from "date-fns";
import Link from "next/link";
import { Plus, Clock, User, DollarSign, RefreshCw, Trash2, X, Eye } from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import MultiSearchableSelect from "@/components/dashboard/MultiSearchableSelect";
import StaffCalendar from "@/components/appointments/StaffCalendar";
import { formatCurrency } from "@/lib/currency";
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatAppointmentDateTime } from '@/lib/zaloDate';

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
    staff: Staff;
    services: { service: Service; name: string; price: number; duration: number }[];
    date: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    discount: {
        type: 'percentage' | 'fixed';
        value: number;
    };
    commission: number;
    status: string;
    notes?: string;
}

export default function CalendarPage() {
    const { settings } = useSettings();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [taxRate, setTaxRate] = useState(0);

    // THÊM STATE CHO TẠO CUSTOMER NHANH
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [newCustomerGender, setNewCustomerGender] = useState("other");
    const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

    const [formData, setFormData] = useState({
        customerId: "",
        staffId: "",
        serviceIds: [] as string[],
        startTime: "",
        date: format(new Date(), "yyyy-MM-dd"),
        discount: { type: 'percentage' as 'percentage' | 'fixed', value: 0 },
        notes: "",
        status: "confirmed"
    });

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
        fetchSettings();
    }, []);

    useEffect(() => {
        if (formData.date && isModalOpen) {
            fetchAvailableSlots();
        } else {
            setAvailableSlots([]);
        }
    }, [formData.date, isModalOpen]);

    const fetchResources = async () => {
        const [staffRes, serviceRes, customerRes] = await Promise.all([
            fetch("/api/staff"),
            fetch("/api/services"),
            fetch("/api/customers")
        ]);
        const staffData = await staffRes.json();
        const serviceData = await serviceRes.json();
        const customerData = await customerRes.json();

        if (staffData.success) setStaffList(staffData.data);
        if (serviceData.success) setServices(serviceData.data);
        if (customerData.success) setCustomers(customerData.data);
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            if (data.success) {
                setTaxRate(data.data.taxRate || 0);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.startTime) {
            setFormError("Please select a time slot");
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedServices = services.filter(s => formData.serviceIds.includes(s._id));
            const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
            const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);

            const discountType = formData.discount.type;
            const discountVal = Math.max(0, Number(formData.discount.value) || 0);
            const discountAmount = discountType === 'fixed'
                ? Math.min(discountVal, subtotal)
                : subtotal * (discountVal / 100);
            const tax = subtotal * (settings.taxRate / 100);
            const totalAmount = Math.max(0, subtotal + tax - discountAmount);

            const staff = staffList.find(s => s._id === formData.staffId);
            const staffRate = staff?.commissionRate || 0;

            let commission = 0;
            selectedServices.forEach(svc => {
                const commType = svc.commissionType || 'percentage';
                const commValue = svc.commissionValue !== undefined ? svc.commissionValue : staffRate;

                if (commType === 'percentage') {
                    const shareOfTotal = subtotal > 0 ? (totalAmount * (svc.price / subtotal)) : 0;
                    commission += (shareOfTotal * commValue) / 100;
                } else {
                    commission += commValue;
                }
            });

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
                discount: { type: discountType, value: discountVal },
                commission,
                status: formData.status,
                notes: formData.notes
            };
            if (formData.staffId) {
                payload.staff = formData.staffId;
            }

            const url = editingAppointment ? `/api/appointments/${editingAppointment._id}` : "/api/appointments";
            const res = await fetch(url, {
                method: editingAppointment ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                const updatedApt = data.data; // Lấy dữ liệu trả về từ Backend
                console.log("serviceIds:", formData.serviceIds);
                console.log("services:", services);
                console.log("selectedServices:", selectedServices);
                // 👉 GỬI ZALO NẾU TRẠNG THÁI LÀ CONFIRMED HOẶC CANCELLED
                if (updatedApt.status === 'confirmed' || updatedApt.status === 'cancelled') {

                    // 1. Tìm khách hàng an toàn (Ép kiểu toString để tránh lỗi so sánh Object và String)
                    const fullCustomer = customers.find(c =>
                        c._id?.toString() === formData.customerId?.toString()
                    );

                    // 2. Lắp ráp dữ liệu thông minh: Ưu tiên customer backend trả về, nếu không có mới dùng fullCustomer
                    const customerData = updatedApt.customer?.phone
                        ? updatedApt.customer
                        : fullCustomer;

                    const aptForZalo = {
                        ...updatedApt,
                        customer: customerData || { phone: '', name: 'Quý khách' }
                    };

                    // 3. THÊM AWAIT: Đợi lệnh gửi Zalo được đẩy đi thành công rồi mới đóng Modal
                    if (aptForZalo.customer?.phone) {
                        await triggerZaloZNS(aptForZalo, updatedApt.status);
                    } else {
                        console.warn("⚠️ Không thể gửi Zalo vì không tìm thấy số điện thoại khách hàng!");
                    }
                }

                // fetchAppointments();
                setRefreshTrigger(prev => prev + 1);
                closeModal();
            } else {
                setFormError(data.error || "Failed to save appointment");
            }
        } catch (error) {
            setFormError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!editingAppointment || !confirm("Are you sure you want to cancel/delete this appointment?")) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/appointments/${editingAppointment._id}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setRefreshTrigger(prev => prev + 1);
                closeModal();
            } else {
                setFormError(data.error || "Failed to delete appointment");
            }
        } catch (error) {
            setFormError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (apt: Appointment) => {
        setEditingAppointment(apt);

        // Handle services mapping correctly from populated or unpopulated state
        const serviceIds = apt.services.map(s => {
            if (typeof s.service === 'string') return s.service;
            return (s.service as any)?._id || String(s.service);
        }).filter(Boolean) as string[];

        setFormData({
            customerId: apt.customer?._id || "",
            staffId: apt.staff?._id || "",
            serviceIds: serviceIds,
            startTime: apt.startTime || "",
            date: apt.date ? format(new Date(apt.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
            discount: apt.discount && typeof apt.discount === 'object'
                ? { type: apt.discount.type || 'percentage', value: apt.discount.value || 0 }
                : { type: 'percentage', value: 0 },
            notes: apt.notes || "",
            status: apt.status || "confirmed"
        });
        setFormError("");
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAppointment(null);
        setFormError("");
        setFormData({
            customerId: "", staffId: "", serviceIds: [], startTime: "",
            date: format(new Date(), "yyyy-MM-dd"),
            discount: { type: 'percentage', value: 0 },
            notes: "", status: "confirmed"
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
                    phone: newCustomerPhone,
                    gender: newCustomerGender,
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
                setNewCustomerGender("other");
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

    const onSelectEvent = async (event: any) => {
        try {
            // Show loading state or just fetch
            const res = await fetch(`/api/appointments/${event.id}`);
            const data = await res.json();
            if (data.success) {
                openEditModal(data.data);
            }
        } catch (error) {
            console.error("Error fetching event details:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="p-4 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-sm border border-primary-100 dark:border-primary-900/50">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Salon Calendar</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Live Schedule Management</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        className="p-3 text-gray-500 hover:text-primary-900 hover:bg-primary-50 dark:text-gray-400 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 rounded-xl transition-all border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm group"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 transition-transform duration-500 group-hover:rotate-180 ${loadingSlots ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => { closeModal(); setIsModalOpen(true); }}
                        className="px-4 py-2 bg-primary-900 text-white rounded-xl hover:bg-primary-800 transition-all flex items-center gap-2 font-bold shadow-lg shadow-primary-900/30 hover:-translate-y-0.5"
                    >
                        <Plus className="w-5 h-5" />
                        Book Appointment
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-4">
                <StaffCalendar
                    refreshTrigger={refreshTrigger}
                    onSelectEvent={onSelectEvent}
                />
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAppointment ? "Appointment Details" : "New Booking"}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {formError && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center gap-3">
                            <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-red-600">!</span>
                            {formError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FormInput
                            label="Date"
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Giảm giá
                            </label>

                            <div className="flex flex-row gap-2">
                                {/* Type */}
                                <select
                                    value={formData.discount.type}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            discount: {
                                                ...formData.discount,
                                                type: e.target.value as 'percentage' | 'fixed',
                                                value: 0, // reset để tránh lỗi logic
                                            },
                                        })
                                    }
                                    className="w-auto px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
                                >
                                    <option value="percentage">%</option>
                                    <option value="fixed">₫</option>
                                </select>

                                {/* Value */}
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max={formData.discount.type === 'percentage' ? 100 : undefined}
                                        value={formData.discount.value}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value) || 0;
                                            if (formData.discount.type === 'percentage' && val > 100) val = 100;

                                            setFormData({
                                                ...formData,
                                                discount: { ...formData.discount, value: val },
                                            });
                                        }}
                                        className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
                                        placeholder={formData.discount.type === 'percentage' ? "0–100" : "Nhập số tiền"}
                                    />

                                    {/* Unit */}
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                        {formData.discount.type === 'percentage' ? "%" : "₫"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Customer */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    />

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2 px-1">
                            <Clock className="w-4 h-4 text-primary-900" />
                            Select Available Time Slot
                            {formData.date && loadingSlots && (
                                <span className="text-xs font-normal text-gray-400 animate-pulse ml-2">(Updating slots...)</span>
                            )}
                        </label>

                        {formData.date ? (
                            availableSlots.length > 0 ? (
                                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2 p-3 bg-gray-50 dark:bg-slate-900 dark:border-gray-700 border border-gray-200 rounded-xl max-h-48 overflow-y-auto shadow-inner">
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
                                <div className="p-4 md:p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-gray-700 text-sm text-gray-500 text-center">
                                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    {loadingSlots ? "Loading available spots..." : "No available slots for this date."}
                                </div>
                            )
                        ) : (
                            <div className="p-4 md:p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 dark:bg-slate-900 dark:border-gray-700 text-sm text-gray-500 text-center">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                Please select date to view availability
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gradient-to-br from-primary-900 to-indigo-900 rounded-xl text-white shadow-xl">
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
                                            const discountVal = formData.discount.value || 0;
                                            const discountAmt = formData.discount.type === 'fixed'
                                                ? Math.min(discountVal, subtotal)
                                                : subtotal * (discountVal / 100);
                                            return formatCurrency(Math.max(0, subtotal + tax - discountAmt));
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        <FormInput label="Notes" value={formData.notes} onChange={(e: any) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        {editingAppointment && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all flex items-center gap-2"
                                disabled={isSubmitting}
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>

                        )}
                        <div className="flex gap-3 ml-auto">
                            {/* <button
                                type="button"
                                onClick={closeModal}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700 transition-all"
                            >
                                Close
                            </button> */}
                            {editingAppointment && (
                                <Link
                                    href={`/invoices/print/${editingAppointment._id}`}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors rounded-xl"
                                >
                                    <Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    View Receipt
                                </Link>
                            )}
                            <FormButton
                                type="submit"
                                loading={isSubmitting}
                                className="rounded-xl font-black px-10 shadow-lg shadow-primary-900/20"
                            >
                                {editingAppointment ? "Save Changes" : "Confirm Booking"}
                            </FormButton>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* THÊM VÀO ĐÂY: Modal Tạo Khách Hàng Nhanh */}
            {isAddCustomerModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-white p-4 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Thêm Khách Hàng Mới</h3>
                            <button
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Tên Khách Hàng <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                                    placeholder="Nhập tên khách hàng"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Số Điện Thoại <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    value={newCustomerPhone}
                                    required
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                                    placeholder="Nhập số điện thoại"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Giới Tính</label>
                                <select
                                    value={newCustomerGender}
                                    onChange={(e) => setNewCustomerGender(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 text-sm bg-white dark:bg-slate-950 text-gray-900 dark:text-white dark:border-slate-700"
                                >
                                    <option value="other">Không xác định</option>
                                    <option value="female">Nữ</option>
                                    <option value="male">Nam</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setIsAddCustomerModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700"
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

        </div>
    );
}
