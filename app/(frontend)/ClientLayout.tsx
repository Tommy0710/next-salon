"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import Footer from "@/components/dashboard/Footer";
import NavigationLoader from "@/components/NavigationLoader";
import { Toaster } from "react-hot-toast";
import "@/app/globals.css";

export default function DashboardLayout({
    children,
    user
}: {
    children: React.ReactNode;
    user?: { name?: string | null; email?: string | null };
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop state
    const pathname = usePathname();
    const isPosPage = pathname === "/pos";

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const toggleCollapse = () => setIsSidebarCollapsed(!isSidebarCollapsed);

    if (isPosPage) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700">
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3500,
                        style: { borderRadius: '10px', fontWeight: 600, fontSize: '14px' },
                        success: { style: { background: '#052e16', color: '#bbf7d0', border: '1px solid #166534' } },
                        error: { style: { background: '#450a0a', color: '#fecaca', border: '1px solid #991b1b' } },
                    }}
                />
                <NavigationLoader />
                <main>{children}</main>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-900 dark:border-gray-700 dark:bg-[#0b1120] dark:text-slate-200">
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3500,
                    style: { borderRadius: '10px', fontWeight: 600, fontSize: '14px' },
                    success: { style: { background: '#052e16', color: '#bbf7d0', border: '1px solid #166534' } },
                    error: { style: { background: '#450a0a', color: '#fecaca', border: '1px solid #991b1b' } },
                }}
            />
            {/* Navigation Loading Overlay */}
            <NavigationLoader />

            {/* Sidebar */}
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                isSidebarCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
            />

            {/* Main Content Area */}
            <div
                className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
                    }`}
            >
                <Header
                    toggleSidebar={toggleSidebar}
                    toggleCollapse={toggleCollapse}
                    isSidebarCollapsed={isSidebarCollapsed}
                    user={user}
                />

                <main className="flex-1 overflow-y-auto overflow-x-hidden dark:bg-slate-950 p-4 md:p-6 lg:p-8">{children}</main>

                <Footer />
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
