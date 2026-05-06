'use client';

import { memo } from 'react';
import { Search, Filter } from 'lucide-react';

interface Props {
  searchTerm: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

const AppointmentFilters = memo(function AppointmentFilters({
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusChange,
  onReset,
}: Props) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-950/50">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by customer, booking code..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <select
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={onReset}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium text-sm px-2 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
});

export default AppointmentFilters;
