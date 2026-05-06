"use client";

import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Grid } from "react-window";
import type { CellComponentProps } from "react-window";
import Image from "next/image";
import { Scissors as ScissorsIcon, Package, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { Item } from "../types";

// ─── CellData passed to every grid cell ──────────────────────────────────────

interface CellData {
    items: Item[];
    columnCount: number;
    onAddToCart: (item: Item) => void;
}

// ─── ProductCard ─────────────────────────────────────────────────────────────

interface ProductCardProps {
    item: Item;
    onAddToCart: (item: Item) => void;
}

const ProductCard = memo(function ProductCard({
    item,
    onAddToCart,
}: ProductCardProps) {
    const handleClick = useCallback(
        () => onAddToCart(item),
        [item, onAddToCart]
    );
    const formattedPrice = useMemo(
        () => formatCurrency(item.price),
        [item.price]
    );

    return (
        <button
            onClick={handleClick}
            type="button"
            style={{ position: "absolute", inset: 4 }}
            className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center justify-start text-center p-2 group active:scale-95 duration-75 overflow-hidden"
        >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform flex-shrink-0">
                {item.type === "Service" ? (
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                        <ScissorsIcon className="w-4 h-4 md:w-5 md:h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                ) : item.image ? (
                    <Image
                        src={item.image}
                        alt={item.name}
                        width={40}
                        height={40}
                        loading="lazy"
                        unoptimized
                        className="object-cover rounded-lg border border-gray-200 dark:border-slate-700"
                    />
                ) : (
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                        {item.productType === "PRE_AMOUNT" ? (
                            <Wallet className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
                        ) : (
                            <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
                        )}
                    </div>
                )}
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-[10px] md:text-xs leading-tight line-clamp-2 mb-1">
                {item.name}
            </h3>
            {item.productType === "PRE_AMOUNT" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[8px] font-black rounded-full uppercase mb-0.5">
                    Nạp ví
                </span>
            )}
            <p className="text-primary-900 dark:text-primary-400 font-bold text-xs md:text-sm">
                {formattedPrice}
            </p>
        </button>
    );
});

// ─── CellRenderer (module-level for stable reference) ────────────────────────

function CellRenderer({
    columnIndex,
    rowIndex,
    style,
    items,
    columnCount,
    onAddToCart,
}: CellComponentProps<CellData>) {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= items.length) return <div style={style} />;
    return (
        <div style={style}>
            <ProductCard item={items[index]} onAddToCart={onAddToCart} />
        </div>
    );
}

// ─── Column helper ────────────────────────────────────────────────────────────

function getColumnCount(width: number): number {
    if (width < 360) return 2;
    if (width < 560) return 3;
    if (width < 800) return 4;
    return 5;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function GridSkeleton() {
    return (
        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-slate-950 p-3">
            <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-32 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

// ─── ProductGrid ──────────────────────────────────────────────────────────────

interface ProductGridProps {
    items: Item[];
    loading: boolean;
    onAddToCart: (item: Item) => void;
}

export const ProductGrid = memo(function ProductGrid({
    items,
    loading,
    onAddToCart,
}: ProductGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize((prev) =>
                prev.width === width && prev.height === height
                    ? prev
                    : { width, height }
            );
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const columnCount = useMemo(
        () => getColumnCount(size.width),
        [size.width]
    );
    const columnWidth = size.width > 0 ? size.width / columnCount : 100;
    const rowCount = Math.ceil(items.length / columnCount) || 1;

    const cellProps = useMemo<CellData>(
        () => ({ items, columnCount, onAddToCart }),
        [items, columnCount, onAddToCart]
    );

    if (loading) return <GridSkeleton />;

    return (
        <div
            ref={containerRef}
            className="flex-1 min-h-0 bg-gray-50 dark:bg-slate-950 pb-20 md:pb-0"
        >
            {items.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <p className="text-gray-400 dark:text-slate-500 text-sm">
                        Không tìm thấy sản phẩm
                    </p>
                </div>
            ) : size.height > 50 ? (
                <Grid
                    cellComponent={CellRenderer}
                    cellProps={cellProps}
                    columnCount={columnCount}
                    columnWidth={columnWidth}
                    rowCount={rowCount}
                    rowHeight={140}
                    style={{ height: size.height, width: size.width }}
                    overscanCount={2}
                />
            ) : null}
        </div>
    );
});