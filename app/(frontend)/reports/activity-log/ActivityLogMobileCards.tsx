"use client";

import { MobileCardList, MobileCard } from "@/components/dashboard/MobileCardList";
import { format } from "date-fns";
import { Clock, Info, MessageSquare, CheckCircle, XCircle, Activity, PhoneIcon } from "lucide-react";

function getAccentColor(action: string): string {
    switch (action) {
        case "create": return "bg-green-500";
        case "delete": return "bg-red-500";
        case "update": return "bg-amber-500";
        case "login": return "bg-indigo-500";
        case "logout": return "bg-slate-400";
        default: return "bg-primary-500";
    }
}

function getActionBadge(action: string): string {
    const base = "text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full border ";
    switch (action) {
        case "create": return base + "bg-green-50 text-green-700 border-green-200";
        case "delete": return base + "bg-red-50 text-red-700 border-red-200";
        case "update": return base + "bg-amber-50 text-amber-700 border-amber-200";
        case "login": return base + "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "logout": return base + "bg-slate-50 text-slate-700 border-slate-200";
        default: return base + "bg-primary-50 text-primary-700 border-primary-200";
    }
}

interface Props {
    logs: any[];
    tab: string;
}

export function ActivityLogMobileCards({ logs, tab }: Props) {
    if (tab === "action") {
        return (
            <MobileCardList
                items={logs}
                loading={false}
                emptyIcon={<Activity className="w-14 h-14" />}
                emptyText="No activity logs found"
                skeletonColumns={1}
                renderItem={(log) => (
                    <MobileCard accentColor={getAccentColor(log.action)}>
                        <div className="px-4 py-3 pl-6 space-y-2.5">
                            {/* Time & User */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-primary-900 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                        {log.user?.name?.[0] || "S"}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                                            {log.user?.name || "System"}
                                        </div>
                                        <div className="text-[10px] text-gray-400 truncate">
                                            {log.user?.email || "internal@system"}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <div>
                                        <div className="text-[12px] font-bold text-gray-900 dark:text-white">
                                            {format(new Date(log.createdAt), "MMM dd, yyyy")}
                                        </div>
                                        <div className="text-[10px] text-gray-400 uppercase">
                                            {format(new Date(log.createdAt), "hh:mm a")}
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Action + Resource */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={getActionBadge(log.action)}>{log.action}</span>
                                <span className="text-[10px] font-bold text-primary-900 px-2 py-0.5 rounded-md bg-primary-50 border border-primary-100 uppercase tracking-wider">
                                    {log.resource}
                                </span>
                            </div>

                            {/* Details */}
                            {log.details && (
                                <div className="flex items-start gap-1.5">
                                    <Info className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {log.details}
                                    </p>
                                </div>
                            )}
                        </div>
                    </MobileCard>
                )}
            />
        );
    }

    // Zalo tab
    return (
        <MobileCardList
            items={logs}
            loading={false}
            emptyIcon={<MessageSquare className="w-14 h-14" />}
            emptyText="No Zalo events found"
            skeletonColumns={1}
            renderItem={(log) => (
                <MobileCard accentColor={log.status === "success" ? "bg-green-500" : "bg-red-500"}>
                    <div className="px-4 py-3 pl-6 space-y-2.5">
                        {/* Template */}
                        <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[12px] font-bold text-gray-900 dark:text-white truncate">
                                    {log.templateName || log.templateId}
                                </div>
                                <div className="text-[10px] text-gray-400">ID: {log.templateId}</div>
                            </div>
                        </div>

                        {/* Phone + Date */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <PhoneIcon className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                <span className="text-[12px] font-mono text-gray-700 dark:text-gray-300">
                                    {log.phone}
                                </span>
                            </div>

                            <div className="text-right shrink-0">
                                <div className="text-[11px] font-bold text-gray-900 dark:text-white">
                                    {format(new Date(log.sentAt), "MMM dd, yyyy")}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase">
                                    {format(new Date(log.sentAt), "hh:mm a")}
                                </div>
                            </div>
                        </div>

                        {/* Status + Event Type */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${log.status === "success"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-red-50 text-red-700 border-red-200"
                                }`}>
                                {log.status === "success"
                                    ? <CheckCircle className="w-3 h-3" />
                                    : <XCircle className="w-3 h-3" />}
                                {log.status}
                            </span>
                            <span className="text-[10px] font-bold text-primary-900 px-2 py-0.5 rounded-md bg-primary-50 border border-primary-100 uppercase tracking-wider">
                                {log.eventType || "N/A"}
                            </span>
                        </div>

                        {/* Details */}
                        {(log.errorMessage || log.trackingId) && (
                            <div className="flex items-start gap-1.5">
                                <Info className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                                    {log.errorMessage || `Tracking: ${log.trackingId}`}
                                </p>
                            </div>
                        )}
                    </div>
                </MobileCard>
            )}
        />
    );
}
