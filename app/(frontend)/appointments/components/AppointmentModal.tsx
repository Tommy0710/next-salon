'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, DollarSign, Calendar, Plus } from 'lucide-react';
import Modal from '@/components/dashboard/Modal';
import FormInput, { FormSelect, FormButton } from '@/components/dashboard/FormInput';
import SearchableSelect from '@/components/dashboard/SearchableSelect';
import MultiSearchableSelect from '@/components/dashboard/MultiSearchableSelect';
import { formatCurrency } from '@/lib/currency';
import type {
  Appointment,
  AppointmentFormData,
  AppointmentFinancials,
  Customer,
  Service,
  Staff,
} from '../types';

interface Props {
  isOpen: boolean;
  editingAppointment: Appointment | null;
  formData: AppointmentFormData;
  setFormData: React.Dispatch<React.SetStateAction<AppointmentFormData>>;
  formError: string;
  isSubmitting: boolean;
  availableSlots: { startTime: string }[];
  loadingSlots: boolean;
  financials: AppointmentFinancials;
  services: Service[];
  staffList: Staff[];
  customers: Customer[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenAddCustomer: () => void;
}

const AppointmentModal = memo(function AppointmentModal({
  isOpen,
  editingAppointment,
  formData,
  setFormData,
  formError,
  isSubmitting,
  availableSlots,
  loadingSlots,
  financials,
  services,
  staffList,
  customers,
  onClose,
  onSubmit,
  onOpenAddCustomer,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAppointment ? 'Edit Appointment' : 'New Appointment'}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Error banner */}
        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium overflow-hidden"
            >
              {formError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 1: Date + Discount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <FormInput
            label="Date"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          />

          <div className="pb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Giảm giá
            </label>
            <div className="flex flex-row gap-2">
              <select
                value={formData.discount.type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    discount: { type: e.target.value as 'percentage' | 'fixed', value: 0 },
                  }))
                }
                className="w-auto px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
              >
                <option value="percentage">%</option>
                <option value="fixed">₫</option>
              </select>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max={formData.discount.type === 'percentage' ? 100 : undefined}
                  value={formData.discount.value}
                  onChange={(e) => {
                    let val = parseFloat(e.target.value) || 0;
                    if (formData.discount.type === 'percentage' && val > 100) val = 100;
                    setFormData((prev) => ({
                      ...prev,
                      discount: { ...prev.discount, value: val },
                    }));
                  }}
                  className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-900"
                  placeholder={formData.discount.type === 'percentage' ? '0–100' : 'Nhập số tiền'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {formData.discount.type === 'percentage' ? '%' : '₫'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Customer + Staff */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer<span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex items-center gap-2">
              <SearchableSelect
                placeholder="Select Customer"
                className="flex-1 min-w-0"
                value={formData.customerId}
                onChange={(value) => setFormData((prev) => ({ ...prev, customerId: value }))}
                options={customers.map((c) => ({
                  value: c._id,
                  label: `${c.name} (${c.phone || 'No phone'})`,
                }))}
              />
              <button
                type="button"
                onClick={onOpenAddCustomer}
                className="p-3 bg-primary-100 text-primary-900 rounded-lg hover:bg-primary-200 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <SearchableSelect
            label="Staff (Optional)"
            placeholder="Select Staff"
            value={formData.staffId}
            onChange={(value) => setFormData((prev) => ({ ...prev, staffId: value }))}
            options={staffList.map((s) => ({ value: s._id, label: s.name }))}
          />
        </div>

        {/* Services */}
        <MultiSearchableSelect
          label="Services"
          placeholder="Select Services"
          required
          value={formData.serviceIds}
          onChange={(values) => setFormData((prev) => ({ ...prev, serviceIds: values }))}
          options={services.map((s) => ({
            value: s._id,
            label: `${s.name} (${formatCurrency(s.price)})`,
          }))}
          key={`service-select-${editingAppointment?._id || 'new'}`}
        />

        {/* Time slots */}
        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-900 dark:text-primary-400" />
            Select Available Time Slot
            {formData.date && loadingSlots && (
              <span className="text-xs font-normal text-gray-400 animate-pulse ml-2">
                (Updating slots...)
              </span>
            )}
          </label>

          {formData.date ? (
            availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2 p-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                {availableSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, startTime: slot.startTime }))
                    }
                    className={`px-3 py-2.5 text-xs font-bold rounded-lg border transition-all duration-200 ${
                      formData.startTime === slot.startTime
                        ? 'bg-primary-900 dark:bg-primary-700 text-white border-primary-900 shadow-lg scale-105'
                        : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-950/50 text-sm text-gray-500 dark:text-gray-400 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                {loadingSlots ? 'Loading available spots...' : 'No available slots for this date.'}
              </div>
            )
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-950/50 text-sm text-gray-500 dark:text-gray-400 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Please select date to view availability
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="mt-6 p-4 bg-gradient-to-br from-primary-900 to-indigo-900 rounded-xl text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-primary-100 text-[10px] font-bold uppercase tracking-wider">
                Estimated Duration
              </p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-300" />
                <span className="text-xl font-bold">{financials.totalDuration} min</span>
              </div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div className="text-right space-y-1">
              <p className="text-primary-100 text-[10px] font-bold uppercase tracking-wider">
                Total Amount
              </p>
              <div className="flex items-center justify-end gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl font-black">
                  {formatCurrency(financials.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status + Notes */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <FormSelect
            label="Status"
            value={formData.status}
            onChange={(e: any) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <FormInput
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <FormButton type="submit" loading={isSubmitting}>
            {editingAppointment ? 'Update Appointment' : 'Book Appointment'}
          </FormButton>
        </div>
      </motion.form>
    </Modal>
  );
});

export default AppointmentModal;
