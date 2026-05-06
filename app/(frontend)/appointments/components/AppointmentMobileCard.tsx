'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import {
  Clock,
  User,
  Hash,
  Globe,
  Tag,
  Scissors,
  Eye,
  CheckCircle,
  X,
  Bell,
  Edit,
  Trash2,
  Calendar,
} from 'lucide-react';
import { MobileCardList, MobileCard } from '@/components/dashboard/MobileCardList';
import { ActionDropdown } from '@/components/dashboard/ActionDropdown';
import { formatCurrency } from '@/lib/currency';
import type { Appointment } from '../types';

const ACCENT_MAP: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  completed: 'bg-blue-500',
  pending: 'bg-amber-400',
  cancelled: 'bg-gray-400',
};

const BADGE_MAP: Record<string, string> = {
  confirmed:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200',
  completed:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200',
  pending:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200',
  cancelled:
    'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700',
};

interface Props {
  appointments: Appointment[];
  isLoading: boolean;
  onView: (apt: Appointment) => void;
  onEdit: (apt: Appointment) => void;
  onDelete: (id: string) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onReminder: (apt: Appointment) => void;
}

function AppointmentMobileCard({
  appointments,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onStatusUpdate,
  onReminder,
}: Props) {
  return (
    <MobileCardList
      items={appointments}
      loading={isLoading}
      emptyIcon={<Calendar className="w-14 h-14" />}
      emptyText="No appointments found"
      skeletonColumns={2}
      renderItem={(apt) => {
        const accentColor = ACCENT_MAP[apt.status] ?? 'bg-gray-400';
        const badgeClass = BADGE_MAP[apt.status] ?? BADGE_MAP.cancelled;
        const totalDuration = apt.services.reduce((s, sv) => s + sv.duration, 0);

        return (
          <MobileCard accentColor={accentColor}>
            {/* Actions */}
            <div className="absolute right-1 top-1 z-[1]">
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
                    variant: 'warning',
                    hidden: apt.status === 'cancelled' || apt.status === 'completed',
                  },
                  {
                    label: apt.reminderCount
                      ? `Nhắc lịch hẹn (${apt.reminderCount}x)`
                      : 'Nhắc lịch hẹn',
                    icon: <Bell className="w-4 h-4" />,
                    onClick: () => onReminder(apt),
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

            {/* 2-column layout */}
            <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-slate-800 pl-3">
              {/* Col 1: Booking info */}
              <div className="px-3 py-3 pr-4 flex flex-col gap-2 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 p-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg shrink-0">
                    <Clock className="w-3.5 h-3.5 text-primary-700 dark:text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight">
                      {format(new Date(apt.date), 'dd MMM yyyy')}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      {apt.startTime} – {apt.endTime}
                    </div>
                  </div>
                </div>

                {apt.bookingCode && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-[11px] font-mono font-bold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded truncate">
                      {apt.bookingCode}
                    </span>
                  </div>
                )}

                {apt.source && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">
                      {apt.source}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-1.5 min-w-0">
                  <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">
                      {apt.customer?.name}
                    </div>
                    {apt.customer?.phone && (
                      <div className="text-[10px] text-gray-400 truncate">{apt.customer.phone}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <Scissors className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                    {apt.staff?.name ?? <span className="italic text-gray-400">No staff</span>}
                  </span>
                </div>
              </div>

              {/* Col 2: Services & price */}
              <div className="px-3 py-3 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Tag className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Services
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {apt.services.slice(0, 2).map((s, idx) => (
                      <span
                        key={idx}
                        title={s.name}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-800/30 max-w-full truncate"
                      >
                        {s.name}
                      </span>
                    ))}
                    {apt.services.length > 2 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        +{apt.services.length - 2}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {apt.services.length} svc · {totalDuration} min
                  </div>
                </div>

                <span className="text-[14px] font-black text-gray-900 dark:text-white">
                  {formatCurrency(apt.totalAmount)}
                </span>

                <div className="mt-auto pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${accentColor}`} />
                    {apt.status}
                  </span>
                </div>
              </div>
            </div>
          </MobileCard>
        );
      }}
    />
  );
}

export default memo(AppointmentMobileCard);
