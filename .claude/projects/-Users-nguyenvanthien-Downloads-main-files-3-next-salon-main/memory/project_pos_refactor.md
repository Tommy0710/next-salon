---
name: POS Page Performance Refactor
description: Full refactor of POS page for virtualization, memoization, and split architecture
type: project
---

POSPage at app/(frontend)/pos/page.tsx was fully refactored for production performance (May 2025).

**Why:** POS page was a 1200-line monolith with no virtualization, causing lag with 1000+ products.

**Architecture created:**
- `app/(frontend)/pos/types.ts` — shared interfaces (Item, Bill, Customer, StaffMember, Totals)
- `app/(frontend)/pos/utils.ts` — createEmptyBill, getCartItemKey, computeTotals, EMPTY_TOTALS
- `app/(frontend)/pos/components/ProductGrid.tsx` — react-window 2.x Grid with ResizeObserver
- `app/(frontend)/pos/components/CartItemRow.tsx` — memo cart row with per-item useCallback
- `app/(frontend)/pos/components/BillTabs.tsx` — memo bill tab bar
- `app/(frontend)/pos/components/SummaryPanel.tsx` — memo summary with pre-formatted currency
- `app/(frontend)/pos/components/CartPanel.tsx` — memo cart container
- `hooks/useDebounce.ts` — generic 300ms debounce hook
- `app/api/pos-init/route.ts` — single unified API replacing 4 separate calls

**Key patterns:**
- react-window 2.x API: `Grid` with `cellComponent` + `cellProps` (NOT the 1.x render-prop API)
- Stable handlers via ref pattern: `activeBillIdRef.current` + empty `useCallback` deps
- Debounced search: `searchInput` (immediate) + `useDebounce(searchInput, 300)` (filtered)
- Debounced localStorage: 400ms timer via `saveTimerRef`
- `computeTotals()` as pure function used in `useMemo`
- `useTransition` for tab switching

**How to apply:** When making changes to POS, maintain the ref pattern for stable callbacks and keep `updateActiveBill` dependency-free. react-window 2.x `Grid` needs `cellComponent` at module level (not inline) for memo to work.
