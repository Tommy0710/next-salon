'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parse, addMinutes } from 'date-fns';
import { useSettings } from '@/components/providers/SettingsProvider';
import { triggerZaloZNS } from '@/lib/zalo-utils';
import type {
  Appointment,
  AppointmentFormData,
  AppointmentFinancials,
  Customer,
  Service,
  Staff,
} from '../types';

const defaultForm = (): AppointmentFormData => ({
  customerId: '',
  staffId: '',
  serviceIds: [],
  startTime: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  discount: { type: 'percentage', value: 0 },
  notes: '',
  status: 'confirmed',
});

interface Props {
  services: Service[];
  staffList: Staff[];
  customers: Customer[];
  onSuccess: () => void;
}

export function useAppointmentForm({ services, staffList, customers, onSuccess }: Props) {
  const { settings } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<AppointmentFormData>(defaultForm());
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ startTime: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Khi services load xong trong lúc đang edit, validate lại serviceIds
  useEffect(() => {
    if (!editingAppointment || !services.length || !isModalOpen) return;
    const ids = editingAppointment.services
      .map((s) => (typeof s.service === 'string' ? s.service : (s.service as any)?._id))
      .filter(Boolean) as string[];
    const validIds = ids.filter((id) => services.some((svc) => svc._id === id));
    setFormData((prev) => ({ ...prev, serviceIds: validIds }));
  }, [services, editingAppointment, isModalOpen]);

  // Fetch available time slots khi date thay đổi
  useEffect(() => {
    if (!formData.date || !isModalOpen) {
      setAvailableSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`/api/appointments/slots?date=${formData.date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setAvailableSlots(data.data.map((time: string) => ({ startTime: time })));
        }
      })
      .catch(() => { if (!cancelled) setAvailableSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [formData.date, isModalOpen]);

  // Tính toán tài chính — memoized, chỉ tính lại khi serviceIds hoặc discount thay đổi
  const financials = useMemo((): AppointmentFinancials => {
    const selected = services.filter((s) => formData.serviceIds.includes(s._id));
    const subtotal = selected.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selected.reduce((sum, s) => sum + s.duration, 0);
    const tax = subtotal * (settings.taxRate / 100);
    const discountVal = Math.max(0, Number(formData.discount.value) || 0);
    const discountAmount =
      formData.discount.type === 'fixed'
        ? Math.min(discountVal, subtotal)
        : subtotal * (discountVal / 100);
    const totalAmount = Math.max(0, subtotal + tax - discountAmount);

    let commission = 0;
    selected.forEach((svc) => {
      const commType = svc.commissionType || 'percentage';
      const commValue = svc.commissionValue ?? 0;
      if (commType === 'percentage') {
        const share = subtotal > 0 ? totalAmount * (svc.price / subtotal) : 0;
        commission += (share * commValue) / 100;
      } else {
        commission += commValue;
      }
    });

    return { subtotal, totalDuration, totalAmount, commission, discountAmount };
  }, [formData.serviceIds, formData.discount, services, settings.taxRate]);

  const openNewModal = useCallback(() => {
    setEditingAppointment(null);
    setFormData(defaultForm());
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback(
    (apt: Appointment) => {
      setEditingAppointment(apt);
      const ids = apt.services
        .map((s) => (typeof s.service === 'string' ? s.service : (s.service as any)?._id))
        .filter(Boolean) as string[];
      const validIds = services.length > 0 ? ids.filter((id) => services.some((svc) => svc._id === id)) : ids;

      setFormData({
        customerId: apt.customer._id,
        staffId: apt.staff?._id || '',
        serviceIds: validIds,
        startTime: apt.startTime,
        date: format(new Date(apt.date), 'yyyy-MM-dd'),
        discount:
          apt.discount && typeof apt.discount === 'object'
            ? { type: apt.discount.type || 'percentage', value: apt.discount.value || 0 }
            : { type: 'percentage', value: 0 },
        notes: apt.notes || '',
        status: apt.status,
      });
      setFormError('');
      setIsModalOpen(true);
    },
    [services]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
    setFormError('');
    setFormData(defaultForm());
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.startTime) { setFormError('Please select a time slot'); return; }

      setIsSubmitting(true);
      try {
        const { totalDuration, totalAmount, commission } = financials;
        const selected = services.filter((s) => formData.serviceIds.includes(s._id));
        const startDT = parse(formData.startTime, 'HH:mm', new Date(formData.date));
        const endTime = format(addMinutes(startDT, totalDuration), 'HH:mm');
        const discountVal = Math.max(0, Number(formData.discount.value) || 0);

        const payload: any = {
          customer: formData.customerId,
          services: selected.map((s) => ({ service: s._id, name: s.name, price: s.price, duration: s.duration })),
          date: formData.date,
          startTime: formData.startTime,
          endTime,
          totalDuration,
          totalAmount,
          discount: { type: formData.discount.type, value: discountVal },
          commission,
          status: formData.status,
          notes: formData.notes,
        };
        if (formData.staffId) payload.staff = formData.staffId;

        const url = editingAppointment ? `/api/appointments/${editingAppointment._id}` : '/api/appointments';
        const res = await fetch(url, {
          method: editingAppointment ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
          const updatedApt = data.data;
          if (updatedApt.status === 'confirmed' || updatedApt.status === 'cancelled') {
            const fullCustomer = customers.find((c) => c._id?.toString() === formData.customerId?.toString());
            const customerData = updatedApt.customer?.phone ? updatedApt.customer : fullCustomer;
            const aptForZalo = { ...updatedApt, customer: customerData || { phone: '', name: 'Quý khách' } };
            if (aptForZalo.customer?.phone) triggerZaloZNS(aptForZalo, updatedApt.status);
          }
          onSuccess();
          closeModal();
        } else {
          setFormError(data.error || 'Failed to save appointment');
        }
      } catch {
        setFormError('An unexpected error occurred');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, financials, services, customers, editingAppointment, onSuccess, closeModal]
  );

  return {
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
  };
}
