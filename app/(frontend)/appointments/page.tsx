'use client';

import { useState, useCallback, useDeferredValue } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { Plus, List, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

import { useAppointmentForm } from './hooks/useAppointmentForm';
import AppointmentFilters from './components/AppointmentFilters';
import AppointmentTable from './components/AppointmentTable';
import AppointmentMobileCard from './components/AppointmentMobileCard';
import AppointmentModal from './components/AppointmentModal';
import CustomerQuickAddModal from './components/CustomerQuickAddModal';
import AppointmentDetailModal from './components/AppointmentDetailModal';
import { triggerZaloZNS, sendReminderZNS } from '@/lib/zalo-utils';
import type { Appointment, Customer, Pagination } from './types';

// Dynamic import StaffCalendar — giảm bundle size ban đầu
const StaffCalendar = dynamic(() => import('@/components/appointments/StaffCalendar'), {
  loading: () => (
    <div className="h-96 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary-900 border-t-transparent rounded-full" />
    </div>
  ),
  ssr: false,
});

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchResources() {
  const [staffRes, serviceRes, customerRes] = await Promise.all([
    fetch('/api/staff?limit=999').then((r) => r.json()),
    fetch('/api/services?limit=999').then((r) => r.json()),
    fetch('/api/customers?limit=999').then((r) => r.json()),
  ]);
  return {
    staffList: staffRes.success ? staffRes.data : [],
    services: serviceRes.success ? serviceRes.data : [],
    customers: customerRes.success ? customerRes.data : [],
  };
}

async function fetchAppointments(
  page: number,
  search: string,
  status: string,
  limit: number,
  sortBy: string,
  sortOrder: string
): Promise<{ appointments: Appointment[]; pagination: Pagination }> {
  const url = `/api/appointments?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${status}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch appointments');
  return { appointments: data.data, pagination: data.pagination };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const queryClient = useQueryClient();

  // View & sort state
  const [view, setView] = useState<'calendar' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'appointment' | 'createdAt'>('appointment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter state — searchTerm deferred agar input tetap smooth
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Calendar refresh
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Detail modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Customer quick-add modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // ─── TanStack Query ──────────────────────────────────────────────────────
  const { data: resources } = useQuery({
    queryKey: ['salon-resources'],
    queryFn: fetchResources,
    staleTime: 1000 * 60 * 5,   // 5 min — staff/service/customer ít thay đổi
    gcTime: 1000 * 60 * 30,
  });

  const staffList = resources?.staffList ?? [];
  const services = resources?.services ?? [];
  const customers = resources?.customers ?? [];

  // Query key bao gồm deferredSearch (không phải searchTerm trực tiếp)
  const aptQueryKey = ['appointments', page, deferredSearch, statusFilter, itemsPerPage, sortBy, sortOrder] as const;

  const { data: aptData, isLoading, isFetching } = useQuery({
    queryKey: aptQueryKey,
    queryFn: () => fetchAppointments(page, deferredSearch, statusFilter, itemsPerPage, sortBy, sortOrder),
    staleTime: 1000 * 60,        // 1 min
    placeholderData: keepPreviousData, // giữ data cũ khi chuyển trang
  });

  const appointments = aptData?.appointments ?? [];
  const pagination: Pagination = aptData?.pagination ?? { total: 0, page: 1, limit: 10, pages: 0 };

  // ─── Mutations ───────────────────────────────────────────────────────────

  // Optimistic status update
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),

    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData(aptQueryKey);
      queryClient.setQueryData(aptQueryKey, (old: typeof aptData) =>
        old
          ? {
              ...old,
              appointments: old.appointments.map((a) =>
                a._id === id ? { ...a, status } : a
              ),
            }
          : old
      );
      return { prev };
    },

    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(aptQueryKey, context.prev);
      toast.error('Failed to update status');
    },

    onSuccess: (data, { id, status }) => {
      if (!data.success) { toast.error(data.error || 'Failed to update status'); return; }
      const apt = appointments.find((a) => a._id === id);
      if (apt && (status === 'confirmed' || status === 'cancelled')) {
        triggerZaloZNS(apt, status);
      }
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/appointments/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: () => toast.error('Failed to delete appointment'),
  });

  // ─── Callbacks ───────────────────────────────────────────────────────────

  const handleStatusUpdate = useCallback(
    (id: string, status: string) => statusMutation.mutate({ id, status }),
    [statusMutation]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!confirm('Are you sure you want to delete this appointment?')) return;
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const handleReminder = useCallback(
    (apt: Appointment) => {
      if (!apt.customer?.phone) { toast.error('Khách hàng không có số điện thoại'); return; }
      toast.promise(
        sendReminderZNS(apt).then(({ reminderCount }) => {
          queryClient.setQueryData(aptQueryKey, (old: typeof aptData) =>
            old
              ? {
                  ...old,
                  appointments: old.appointments.map((a) =>
                    a._id === apt._id ? { ...a, reminderCount } : a
                  ),
                }
              : old
          );
        }),
        {
          loading: 'Đang gửi nhắc lịch...',
          success: `Đã nhắc lịch thành công cho ${apt.customer.name}`,
          error: (err: Error) => `Gửi thất bại: ${err.message}`,
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, aptQueryKey]
  );

  const handleSortChange = useCallback(
    (field: 'appointment' | 'createdAt') => {
      setSortBy(field);
      setSortOrder((prev) => (sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
    },
    [sortBy]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const openDetailModal = useCallback((apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsDetailOpen(true);
  }, []);

  // ─── Form hook ────────────────────────────────────────────────────────────
  const {
    isModalOpen,
    editingAppointment,
    formData,
    setFormData,
    formError,
    isSubmitting,
    availableSlots,
    loadingSlots,
    financials,
    openNewModal,
    openEditModal,
    closeModal,
    handleSubmit,
  } = useAppointmentForm({
    services,
    staffList,
    customers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setRefreshTrigger((p) => p + 1);
    },
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 rounded-lg bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setView('list')}
              className={`w-fit px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                view === 'list'
                  ? 'bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                view === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-primary-900 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Staff Calendar
            </button>
          </div>
        </div>

        <button
          onClick={openNewModal}
          className="w-fit px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-950 flex flex-col">
        <div className="flex-1 pt-4">
          {view === 'calendar' ? (
            <StaffCalendar
              refreshTrigger={refreshTrigger}
              onSelectEvent={async (event) => {
                try {
                  const res = await fetch(`/api/appointments/${event.id}`);
                  const data = await res.json();
                  if (data.success) openEditModal(data.data);
                } catch (err) {
                  console.error('Error opening appointment:', err);
                }
              }}
            />
          ) : (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden text-black dark:text-white">
              <AppointmentFilters
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                onSearchChange={handleSearchChange}
                onStatusChange={handleStatusFilterChange}
                onReset={handleReset}
              />

              {/* Desktop table */}
              <AppointmentTable
                appointments={appointments}
                isLoading={isLoading || (isFetching && appointments.length === 0)}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                onView={openDetailModal}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onStatusUpdate={handleStatusUpdate}
                onReminder={handleReminder}
              />

              {/* Mobile cards */}
              <AppointmentMobileCard
                appointments={appointments}
                isLoading={isLoading}
                onView={openDetailModal}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onStatusUpdate={handleStatusUpdate}
                onReminder={handleReminder}
              />

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Showing{' '}
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {appointments.length}
                  </span>{' '}
                  of{' '}
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {pagination.total}
                  </span>{' '}
                  appointments
                  {isFetching && !isLoading && (
                    <span className="ml-2 text-xs text-gray-400 animate-pulse">Refreshing...</span>
                  )}
                </div>

                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setPage(1); }}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                >
                  <option value="10">10 per page</option>
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                </select>

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
                      let n: number;
                      if (pagination.pages <= 5) n = i + 1;
                      else if (pagination.page <= 3) n = i + 1;
                      else if (pagination.page >= pagination.pages - 2) n = pagination.pages - 4 + i;
                      else n = pagination.page - 2 + i;
                      return (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                            page === n
                              ? 'bg-primary-900 dark:bg-primary-700 text-white'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {n}
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

      {/* ─── Modals ─── */}
      <AppointmentModal
        isOpen={isModalOpen}
        editingAppointment={editingAppointment}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        isSubmitting={isSubmitting}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        financials={financials}
        services={services}
        staffList={staffList}
        customers={customers}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
      />

      <CustomerQuickAddModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCreated={(customer: Customer) => {
          // Cập nhật cache để dropdown hiển thị ngay
          queryClient.setQueryData(['salon-resources'], (old: typeof resources) =>
            old ? { ...old, customers: [...old.customers, customer] } : old
          );
          setFormData((prev) => ({ ...prev, customerId: customer._id }));
        }}
      />

      <AppointmentDetailModal
        isOpen={isDetailOpen}
        appointment={selectedAppointment}
        onClose={() => { setIsDetailOpen(false); setSelectedAppointment(null); }}
      />
    </div>
  );
}
