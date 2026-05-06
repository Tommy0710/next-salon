'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import {
  Clock,
  User,
  Calendar,
  ArrowUpDown,
  Eye,
  CheckCircle,
  X,
  Bell,
  Edit,
  Trash2,
} from 'lucide-react';
import { ActionDropdown } from '@/components/dashboard/ActionDropdown';
import { formatCurrency } from '@/lib/currency';
import type { Appointment } from '../types';

// ─── Skeleton row với độ rộng đa dạng ──────────────────────────────────────
const SkeletonRow = memo(function SkeletonRow({ index }: { index: number }) {
  const widths = ['70%', '50%', '80%', '60%', '90%', '45%', '55%', '65%', '75%', '40%'];
  return (
    <tr className="animate-pulse border-b border-gray-100 dark:border-slate-800/50">
      {widths.map((w, i) => (
        <td key={i} className="px-6 py-4">
          <div
            className="h-4 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 rounded-md bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"
            style={{ width: w, animationDelay: `${index * 80}ms` }}
          />
        </td>
      ))}
    </tr>
  );
});

// ─── Status badge mapping ────────────────────────────────────────────────────
const STATUS_CLASSES: Record<string, string> = {
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed:
    'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  cancelled:
    'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700',
};

// ─── Memoized table row ──────────────────────────────────────────────────────
interface RowProps {
  apt: Appointment;
  onView: (apt: Appointment) => void;
  onEdit: (apt: Appointment) => void;
  onDelete: (id: string) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onReminder: (apt: Appointment) => void;
}

const AppointmentRow = memo(function AppointmentRow({
  apt,
  onView,
  onEdit,
  onDelete,
  onStatusUpdate,
  onReminder,
}: RowProps) {
  return (
    <tr className="hover:bg-gray-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-colors group">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
            <Clock className="w-4 h-4 text-primary-900 dark:text-primary-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {format(new Date(apt.date), 'dd MMM yyyy')}
            </span>
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {apt.startTime} – {apt.endTime}
            </div>
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
        {apt.customer?.phone && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{apt.customer.phone}</div>
        )}
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          {apt.staff?.name || <span className="text-gray-400 italic">—</span>}
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex flex-col gap-1 max-w-xs">
          <div className="flex flex-wrap gap-1">
            {apt.services.slice(0, 2).map((s, idx) => (
              <span
                key={idx}
                title={s.name}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-800/30 truncate max-w-[160px]"
              >
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
            {apt.services.length} service{apt.services.length > 1 ? 's' : ''},{' '}
            {apt.services.reduce((sum, s) => sum + s.duration, 0)} min
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {formatCurrency(apt.totalAmount)}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
          {apt.source || 'Direct'}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${STATUS_CLASSES[apt.status] || STATUS_CLASSES.cancelled}`}
        >
          {apt.status}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {format(new Date(apt.createdAt || apt.date), 'dd MMM yyyy HH:mm')}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="relative flex justify-end">
        <ActionDropdown
          panelWidth="w-52"
          items={[
            {
              label: 'Xem thông tin',
              icon: <Eye className="w-4 h-4" />,
              onClick: () => onView(apt),
              variant: 'primary',
            },
            {
              label: 'Complete',
              icon: <CheckCircle className="w-4 h-4" />,
              onClick: () => onStatusUpdate(apt._id, 'completed'),
              variant: 'success',
              hidden: apt.status === 'completed',
            },
            {
              label: 'Confirm',
              icon: <CheckCircle className="w-4 h-4" />,
              onClick: () => onStatusUpdate(apt._id, 'confirmed'),
              variant: 'primary',
              hidden: apt.status !== 'pending',
            },
            {
              label: 'Cancel',
              icon: <X className="w-4 h-4" />,
              onClick: () => onStatusUpdate(apt._id, 'cancelled'),
              hidden: apt.status === 'cancelled' || apt.status === 'completed',
            },
            {
              label: apt.reminderCount
                ? `Nhắc lịch hẹn (${apt.reminderCount}x)`
                : 'Nhắc lịch hẹn',
              icon: <Bell className="w-4 h-4" />,
              onClick: () => onReminder(apt),
              variant: 'warning',
              hidden: apt.status === 'cancelled' || apt.status === 'completed',
            },
            {
              label: 'Edit Details',
              icon: <Edit className="w-4 h-4" />,
              onClick: () => onEdit(apt),
            },
            {
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => onDelete(apt._id),
              variant: 'danger',
              dividerBefore: true,
            },
          ]}
        />
        </div>
      </td>
    </tr>
  );
});

// ─── Main table component ────────────────────────────────────────────────────
interface TableProps {
  appointments: Appointment[];
  isLoading: boolean;
  sortBy: 'appointment' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'appointment' | 'createdAt') => void;
  onView: (apt: Appointment) => void;
  onEdit: (apt: Appointment) => void;
  onDelete: (id: string) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onReminder: (apt: Appointment) => void;
}

const AppointmentTable = memo(function AppointmentTable({
  appointments,
  isLoading,
  sortBy,
  sortOrder,
  onSortChange,
  onView,
  onEdit,
  onDelete,
  onStatusUpdate,
  onReminder,
}: TableProps) {
  return (
    <div className="hidden md:block flex-1 overflow-auto overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
        <thead className="bg-gray-50 dark:bg-slate-900">
          <tr>
            <th
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors select-none"
              onClick={() => onSortChange('appointment')}
            >
              <div className="flex items-center gap-2">
                <span>Appointment</span>
                <ArrowUpDown
                  className={`w-3.5 h-3.5 ${sortBy === 'appointment' ? 'text-primary-900 dark:text-primary-400' : 'text-gray-400'}`}
                />
              </div>
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Booking Code
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Staff
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Services
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Source
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors select-none"
              onClick={() => onSortChange('createdAt')}
            >
              <div className="flex items-center gap-2">
                <span>Created</span>
                <ArrowUpDown
                  className={`w-3.5 h-3.5 ${sortBy === 'createdAt' ? 'text-primary-900 dark:text-primary-400' : 'text-gray-400'}`}
                />
              </div>
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-100 dark:divide-slate-800/50">
          {isLoading && appointments.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} index={i} />)
          ) : appointments.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-6 py-16 text-center text-gray-500 dark:text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No appointments found</p>
              </td>
            </tr>
          ) : (
            appointments.map((apt) => (
              <AppointmentRow
                key={apt._id}
                apt={apt}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusUpdate={onStatusUpdate}
                onReminder={onReminder}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

export default AppointmentTable;
