import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectToDB } from "@/lib/mongodb";
import { ActivityLog, User, ZaloLog } from "@/lib/initModels";
import { format } from "date-fns";
import {
    Shield,
    Clock,
    User as UserIcon,
    Globe,
    Info,
    Search,
    RefreshCcw,
    Filter,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Activity,
    MessageSquare,
    CheckCircle,
    XCircle
} from "lucide-react";
import Link from "next/link";
import ActivityLogFilters from "./ActivityLogFilters";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>;
}

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ActivityLogPage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session) redirect("/login");

    // Permission check
    const role = (session.user as any).role?.name || (session.user as any).role;
    const permissions = (session.user as any).permissions;
    const isSuperAdmin = role === "Super Admin";

    if (!isSuperAdmin && permissions?.activityLogs?.view === "none") {
        return (
            <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl border border-red-200 m-6">
                Access Denied: You do not have permission to view activity logs.
            </div>
        );
    }

    await connectToDB();

    const sParams = await searchParams;

    // Query parameters
    const page = parseInt(sParams.page || "1");
    const limit = parseInt(sParams.limit || "10");
    const tab = sParams.tab || "action";
    const skip = (page - 1) * limit;
    const search = sParams.search || "";

    // Fetch data based on tab
    let logs: any[] = [];
    let total = 0;

    if (tab === "action") {
        // Build query for ActivityLog
        let query: any = {};
        if (search) {
            query.$or = [
                { action: { $regex: search, $options: "i" } },
                { resource: { $regex: search, $options: "i" } },
                { details: { $regex: search, $options: "i" } }
            ];
        }

        [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate("user", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(query)
        ]);
    } else if (tab === "zalo") {
        // Build query for ZaloLog
        let query: any = {};
        if (search) {
            query.$or = [
                { phone: { $regex: search, $options: "i" } },
                { templateName: { $regex: search, $options: "i" } },
                { eventType: { $regex: search, $options: "i" } },
                { templateId: { $regex: search, $options: "i" } }
            ];
        }

        [logs, total] = await Promise.all([
            ZaloLog.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ZaloLog.countDocuments(query)
        ]);
    }

    const totalPages = Math.ceil(total / limit);

    // Helpers
    const getActionBadge = (action: string) => {
        const base = "text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ";
        switch (action) {
            case 'create': return base + "bg-green-50 text-green-700 border-green-200";
            case 'delete': return base + "bg-red-50 text-red-700 border-red-200";
            case 'update': return base + "bg-amber-50 text-amber-700 border-amber-200";
            case 'login': return base + "bg-indigo-50 text-indigo-700 border-indigo-200";
            case 'logout': return base + "bg-slate-50 text-slate-700 border-slate-200";
            default: return base + "bg-primary-50 text-primary-700 border-primary-200";
        }
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
                    <p className="text-gray-500 text-sm">Monitor system activity and Zalo messaging events.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/reports/activity-log"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <Link
                            href={{ query: { ...sParams, tab: "action", page: "1" } }}
                            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${tab === "action"
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <Activity className="w-4 h-4 inline mr-2" />
                            Action Logs
                        </Link>
                        <Link
                            href={{ query: { ...sParams, tab: "zalo", page: "1" } }}
                            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${tab === "zalo"
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <MessageSquare className="w-4 h-4 inline mr-2" />
                            Zalo Events
                        </Link>
                    </nav>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
                {/* Search & Filters */}
                <ActivityLogFilters initialSearch={search} initialLimit={limit} initialTab={tab} />

                {/* Table */}
                <div className="overflow-x-auto text-black">
                    <table className="min-w-full divide-y divide-gray-200">
                        {tab === "action" ? (
                            <>
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp / Event</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User / Identity</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No activity logs found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log: any) => (
                                            <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-primary-50 rounded-lg text-primary-900">
                                                            <Clock className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{format(new Date(log.createdAt), "MMM dd, yyyy")}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium uppercase">{format(new Date(log.createdAt), "hh:mm:ss a")}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary-900 flex items-center justify-center text-white text-xs font-bold">
                                                            {log.user?.name?.[0] || <UserIcon className="w-4 h-4" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-gray-900">{log.user?.name || "System"}</div>
                                                            <div className="text-[10px] text-gray-500">{log.user?.email || "internal@system"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={getActionBadge(log.action)}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-primary-900 px-2 py-0.5 rounded-md bg-primary-50 border border-primary-100 uppercase tracking-wider">
                                                        {log.resource}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div className="flex items-start gap-2">
                                                        <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-gray-600" title={log.details}>
                                                            {log.details || "No additional information"}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </>
                        ) : (
                            <>
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Template</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No Zalo events found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log: any) => (
                                            <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-green-50 rounded-lg text-green-900">
                                                            <MessageSquare className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{log.templateName || log.templateId}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium">ID: {log.templateId}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-mono text-gray-900">{log.phone}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-primary-50 rounded-lg text-primary-900">
                                                            <Clock className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">{format(new Date(log.sentAt), "MMM dd, yyyy")}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium uppercase">{format(new Date(log.sentAt), "hh:mm:ss a")}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${log.status === 'success'
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : "bg-red-50 text-red-700 border-red-200"
                                                        }`}>
                                                        {log.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-primary-900 px-2 py-0.5 rounded-md bg-primary-50 border border-primary-100 uppercase tracking-wider">
                                                        {log.eventType || "N/A"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div className="flex items-start gap-2">
                                                        <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-gray-600" title={log.errorMessage || log.trackingId}>
                                                            {log.errorMessage || `Tracking: ${log.trackingId}`}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500 font-medium">
                        Showing <span className="text-gray-900">{logs.length}</span> of <span className="text-gray-900">{total}</span> records
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={{ query: { ...sParams, page: (page - 1).toString(), limit: limit.toString(), tab } }}
                            className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all ${page <= 1 ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Link>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (page <= 3) pageNum = i + 1;
                                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = page - 2 + i;

                                return (
                                    <Link
                                        key={pageNum}
                                        href={{ query: { ...sParams, page: pageNum.toString(), limit: limit.toString(), tab } }}
                                        className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${page === pageNum
                                            ? "bg-primary-900 text-white"
                                            : "text-gray-600 hover:bg-gray-100 bg-white border border-gray-200"
                                            }`}
                                    >
                                        {pageNum}
                                    </Link>
                                );
                            })}
                        </div>

                        <Link
                            href={{ query: { ...sParams, page: (page + 1).toString(), limit: limit.toString(), tab } }}
                            className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all ${page >= totalPages ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
