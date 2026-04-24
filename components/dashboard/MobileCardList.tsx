"use client";

import React from "react";
import { PackageOpen } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  /** "1" = full-width single column, "2" = split into two equal columns */
  columns?: 1 | 2;
  count?: number;
}

function MobileCardSkeleton({ columns = 2, count = 4 }: SkeletonProps) {
  return (
    <div className="p-3 space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4"
        >
          {columns === 2 ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
                <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-full" />
                <div className="h-5 bg-gray-100 dark:bg-slate-800 rounded-full w-16 mt-1" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/3" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Empty State
// ────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  text?: string;
}

function MobileCardEmpty({ icon, text = "No data found" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-gray-400 dark:text-slate-600">
      <div className="opacity-20 mb-3">
        {icon ?? <PackageOpen className="w-14 h-14" />}
      </div>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MobileCardList
// ────────────────────────────────────────────────────────────────────────────

export interface MobileCardListProps<T> {
  /** Array of data items to render */
  items: T[];
  /** Whether data is loading */
  loading?: boolean;
  /** Custom empty icon */
  emptyIcon?: React.ReactNode;
  /** Custom empty text */
  emptyText?: string;
  /** Number of skeleton placeholder rows */
  skeletonCount?: number;
  /** 1 = single-column skeleton, 2 = two-column skeleton */
  skeletonColumns?: 1 | 2;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Extra class on the outer wrapper (defaults to "md:hidden") */
  className?: string;
  /** Gap between cards (default: "space-y-2.5") */
  gap?: string;
}

/**
 * Generic mobile card list that hides itself on md+ screens.
 *
 * Usage:
 * ```tsx
 * <MobileCardList
 *   items={invoices}
 *   loading={loading}
 *   emptyIcon={<FileText className="w-14 h-14" />}
 *   emptyText="No invoices found"
 *   renderItem={(inv) => <InvoiceMobileCard invoice={inv} />}
 * />
 * ```
 */
export function MobileCardList<T>({
  items,
  loading = false,
  emptyIcon,
  emptyText,
  skeletonCount = 4,
  skeletonColumns = 2,
  renderItem,
  className = "md:hidden",
  gap = "space-y-2.5",
}: MobileCardListProps<T>) {
  return (
    <div className={className}>
      {loading && items.length === 0 ? (
        <MobileCardSkeleton columns={skeletonColumns} count={skeletonCount} />
      ) : items.length === 0 ? (
        <MobileCardEmpty icon={emptyIcon} text={emptyText} />
      ) : (
        <div className={`p-3 ${gap}`}>
          {items.map((item, index) => renderItem(item, index))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MobileCard — base card wrapper (optional helper)
// ────────────────────────────────────────────────────────────────────────────

export interface MobileCardProps {
  children: React.ReactNode;
  /** Left accent bar colour e.g. "bg-emerald-400" */
  accentColor?: string;
  className?: string;
}

/**
 * Base card shell used inside MobileCardList.
 * Provides the rounded container + left accent stripe.
 */
export function MobileCard({
  children,
  accentColor = "bg-gray-300",
  className = "",
}: MobileCardProps) {
  return (
    <div
      className={`relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm ${className}`}
    >
      {/* Left accent stripe */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l ${accentColor}`}
      />
      {children}
    </div>
  );
}

export default MobileCardList;
