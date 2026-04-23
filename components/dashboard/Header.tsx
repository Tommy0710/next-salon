"use client";

import { useState, useRef, useEffect } from "react";
import { User, Menu, ChevronLeft, ChevronRight, LogOut, Settings, Clock } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface HeaderProps {
    toggleSidebar: () => void;
    toggleCollapse: () => void;
    isSidebarCollapsed: boolean;
    user?: {
        name?: string | null;
        email?: string | null;
    };
}

export default function Header({ toggleSidebar, toggleCollapse, isSidebarCollapsed, user }: HeaderProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const [timezone, setTimezone] = useState("UTC");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch timezone from settings
    useEffect(() => {
        const fetchTimezone = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (data.success && data.data.timezone) {
                    setTimezone(data.data.timezone);
                }
            } catch (error) {
                console.error("Failed to fetch timezone", error);
            }
        };
        fetchTimezone();
    }, []);

    // Update time every second
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const timeString = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(now);
            setCurrentTime(timeString);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [timezone]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 md:px-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center">
                {/* Mobile menu button */}
                <button
                    onClick={toggleSidebar}
                    className="p-2 mr-4 text-gray-600 dark:text-gray-300 rounded-lg md:hidden hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                    <span className="sr-only">Open menu</span>
                    <Menu className="w-6 h-6" />
                </button>

                {/* Desktop Collapse Button */}
                <button
                    onClick={toggleCollapse}
                    className="hidden md:flex p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                    {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            <div className="flex items-center gap-4">
                {/* Time and Timezone Display */}
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg border border-primary-100 dark:border-primary-900/50">
                    <Clock className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-primary-900 dark:text-primary-300">{currentTime}</span>
                        <span className="text-xs text-primary-600 dark:text-primary-500">{timezone}</span>
                    </div>
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center space-x-2 focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary-900 flex items-center justify-center text-white font-bold">
                            <User className="w-5 h-5" />
                        </div>
                        {user?.name ? (
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</span>
                        ) : (
                            <User className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                        )}
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 z-10 w-48 mt-2 origin-top-right bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1">
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || "User"}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ""}</p>
                                </div>
                                <Link href="/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                                    <User className="w-4 h-4 mr-2" />
                                    Profile
                                </Link>
                                <Link href="/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </Link>

                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header >
    );
}
