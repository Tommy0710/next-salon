"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    required?: boolean;
    error?: string;
    className?: string;
}

export default function SearchableSelect({
    label,
    value,
    onChange,
    options,
    placeholder = "Select option",
    required,
    error,
    className = "",
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={`${label ? 'mb-4' : ''} ${className}`} ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                <div
                    className={`w-full px-4 py-2 border rounded-lg cursor-pointer flex items-center justify-between bg-white dark:bg-slate-900 ${error ? "border-red-500" : "border-gray-300 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent"
                        }`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className={`block truncate ${!selectedOption ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>

                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No results found</div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <div
                                        key={option.value}
                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-primary-50 dark:hover:bg-slate-800 ${option.value === value ? "bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-400 font-medium" : "text-gray-700 dark:text-gray-300"
                                            }`}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                    >
                                        {option.label}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
