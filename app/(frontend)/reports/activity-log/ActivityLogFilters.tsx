"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { useTransition } from "react";

interface ActivityLogFiltersProps {
    initialSearch: string;
    initialLimit: number;
    initialTab: string;
}

export default function ActivityLogFilters({ initialSearch, initialLimit, initialTab }: ActivityLogFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("search", term);
        } else {
            params.delete("search");
        }
        params.set("page", "1"); // Reset to page 1

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-slate-800/50">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder={initialTab === "zalo" ? "Search Zalo events by phone, template, or event type..." : "Search logs by action or resource..."}
                    defaultValue={initialSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:text-white dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900 transition-all text-sm"
                />
                {isPending && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-900"></div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Show:</span>
                    <select
                        value={initialLimit}
                        onChange={(e) => {
                            const params = new URLSearchParams(searchParams);
                            params.set("limit", e.target.value);
                            params.set("page", "1"); // Reset to page 1
                            startTransition(() => {
                                router.push(`${pathname}?${params.toString()}`);
                            });
                        }}
                        className="px-3 py-1.5 bg-white dark:text-white dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>

                <button
                    onClick={() => {
                        router.push(pathname);
                    }}
                    className="text-sm font-medium text-gray-500 hover:text-primary-900 transition-colors px-2"
                >
                    Reset All
                </button>
            </div>
        </div>
    );
}
