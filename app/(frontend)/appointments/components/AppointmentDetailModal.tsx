'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { X, Bell } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useSettings } from '@/components/providers/SettingsProvider';
import type { Appointment } from '../types';

const STATUS_CLASSES: Record<string, string> = {
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed:
    'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  cancelled:
    'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700',
};

interface Props {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}

const AppointmentDetailModal = memo(function AppointmentDetailModal({
  isOpen,
  appointment,
  onClose,
}: Props) {
  const { settings } = useSettings();

  return (
    <AnimatePresence>
      {isOpen && appointment && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-transparent dark:border-slate-800"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Chi tiết Appointment
              </h3>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Ngày</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(appointment.date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Thời gian</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {appointment.startTime} – {appointment.endTime}
                  </p>
                </div>
              </div>

              {/* Booking Code */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Booking Code</p>
                <div className="bg-primary-50 dark:bg-primary-900/20 px-4 py-3 rounded-lg border border-primary-100 dark:border-primary-800/30">
                  <p className="text-lg font-mono font-bold text-primary-900 dark:text-primary-400">
                    {appointment.bookingCode || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Customer */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Khách hàng</p>
                <div className="bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-transparent dark:border-slate-700">
                  <p className="font-semibold text-gray-900 dark:text-white">{appointment.customer.name}</p>
                  {appointment.customer.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{appointment.customer.phone}</p>
                  )}
                </div>
              </div>

              {/* Staff */}
              {appointment.staff && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Staff</p>
                  <div className="bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-transparent dark:border-slate-700">
                    <p className="font-semibold text-gray-900 dark:text-white">{appointment.staff.name}</p>
                  </div>
                </div>
              )}

              {/* Services */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Dịch vụ</p>
                <div className="space-y-2">
                  {appointment.services.map((service, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg flex justify-between items-center border border-transparent dark:border-slate-700"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{service.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{service.duration} phút</p>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {settings.symbol}{service.price.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tổng tiền</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">
                    {settings.symbol}{appointment.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Giảm giá</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {(() => {
                      const d = (appointment as any).discount;
                      if (!d || (typeof d === 'object' && d.value === 0)) return 'Không giảm giá';
                      if (typeof d === 'object')
                        return d.type === 'fixed' ? formatCurrency(d.value) : `${d.value}%`;
                      return `${d}%`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Commission */}
              {(appointment as any).commission > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Commission</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {settings.symbol}{((appointment as any).commission ?? 0).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Reminder count */}
              {(appointment.reminderCount ?? 0) > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800/30">
                  <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    Đã nhắc lịch {appointment.reminderCount} lần
                  </span>
                </div>
              )}

              {/* Status & Source */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Trạng thái</p>
                  <span
                    className={`inline-block text-xs uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${STATUS_CLASSES[appointment.status] || STATUS_CLASSES.cancelled}`}
                  >
                    {appointment.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Nguồn</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {appointment.source || 'Direct'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {appointment.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Ghi chú</p>
                  <div className="bg-gray-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-transparent dark:border-slate-700">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {appointment.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default AppointmentDetailModal;
