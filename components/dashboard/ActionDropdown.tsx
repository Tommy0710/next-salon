"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type DropdownItemVariant = "default" | "danger" | "success" | "warning" | "primary";

export interface DropdownItem {
  /** Unique key for this item */
  key?: string;
  /** Display label */
  label: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Click handler (use either onClick OR href, not both) */
  onClick?: () => void;
  /** Navigates using Next.js <Link> when provided */
  href?: string;
  /** Visual style variant */
  variant?: DropdownItemVariant;
  /** Render a divider line before this item */
  dividerBefore?: boolean;
  /** Hide this item entirely (useful for conditional rendering) */
  hidden?: boolean;
}

export interface ActionDropdownProps {
  /** Menu items definition */
  items: DropdownItem[];
  /** Custom trigger element. Defaults to a MoreVertical icon button. */
  trigger?: React.ReactNode;
  /** Custom class added to the trigger wrapper */
  triggerClassName?: string;
  /** Dropdown panel alignment relative to trigger */
  align?: "left" | "right";
  /** Panel min-width (Tailwind class, e.g. "w-44") */
  panelWidth?: string;
  /** Extra class on the outer wrapper div */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Variant styles
// ────────────────────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<DropdownItemVariant, string> = {
  default:
    "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800",
  danger:
    "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
  success:
    "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800",
  warning:
    "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800",
  primary:
    "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800",
};

// ────────────────────────────────────────────────────────────────────────────
// ActionDropdown
// ────────────────────────────────────────────────────────────────────────────

/**
 * A self-contained dropdown menu for table row / card actions.
 * Handles open/close state and click-outside detection internally.
 *
 * Usage:
 * ```tsx
 * <ActionDropdown
 *   items={[
 *     { label: "Edit", icon: <Edit className="w-4 h-4" />, onClick: () => openEdit(row) },
 *     { label: "Delete", icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(row._id), variant: "danger", dividerBefore: true },
 *   ]}
 * />
 * ```
 */
export function ActionDropdown({
  items,
  trigger,
  triggerClassName = "",
  align = "right",
  panelWidth = "w-44",
  className = "",
}: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <div ref={wrapperRef} className={`inline-block ${className}`}>
      {/* Trigger */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={triggerClassName}
      >
        {trigger ?? (
          <button
            type="button"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            aria-label="Open actions menu"
            aria-expanded={open}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Panel */}
      {open && (
        <div
          className={`
            absolute top-full mt-1 z-50 py-1 overflow-hidden
            ${panelWidth}
            ${align === "right" ? "right-0" : "left-0"}
            bg-white dark:bg-slate-900
            border border-gray-100 dark:border-slate-800
            rounded-xl shadow-xl
            animate-in fade-in slide-in-from-top-2 duration-150
          `}
          role="menu"
        >
          {visibleItems.map((item, idx) => {
            const variantClass = VARIANT_CLASSES[item.variant ?? "default"];
            const itemClass = `w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${variantClass}`;

            return (
              <React.Fragment key={item.key ?? `item-${idx}`}>
                {item.dividerBefore && idx > 0 && (
                  <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                )}

                {item.href ? (
                  <Link
                    href={item.href}
                    className={itemClass}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={itemClass}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActionDropdown;
