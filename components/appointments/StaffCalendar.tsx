"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, momentLocalizer, Views, Navigate, View } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { User, Clock, MapPin, Tag, RefreshCw } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";

const localizer = momentLocalizer(moment);

interface Event {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId: string;
    status: string;
    customer: string;
    staffName: string;
    services: string[];
}

interface Resource {
    id: string;
    title: string;
}

interface StaffCalendarProps {
    onSelectEvent?: (event: any) => void;
    refreshTrigger?: number;
}

export default function StaffCalendar({ onSelectEvent, refreshTrigger }: StaffCalendarProps) {
    const { settings } = useSettings();
    const [events, setEvents] = useState<Event[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<View>(Views.DAY);

    // Fetch staff as resources
    const fetchResources = useCallback(async () => {
        try {
            const res = await fetch("/api/staff?isActive=true");
            const data = await res.json();
            if (data.success) {
                setResources([
                    {
                        id: "unassigned",
                        title: "No Staff"
                    },
                    ...data.data.map((s: any) => ({
                        id: s._id,
                        title: s.name
                    }))
                ]);
            }
        } catch (error) {
            console.error("Error fetching staff for calendar:", error);
        }
    }, []);

    // Fetch appointments for the current range
    const fetchAppointments = useCallback(async (currentDate: Date, currentView: View) => {
        setLoading(true);
        try {
            let start, end;
            if (currentView === Views.MONTH) {
                start = moment(currentDate).startOf("month").subtract(1, "week").format("YYYY-MM-DD");
                end = moment(currentDate).endOf("month").add(1, "week").format("YYYY-MM-DD");
            } else if (currentView === Views.WEEK) {
                start = moment(currentDate).startOf("week").format("YYYY-MM-DD");
                end = moment(currentDate).endOf("week").format("YYYY-MM-DD");
            } else {
                start = moment(currentDate).startOf("day").format("YYYY-MM-DD");
                end = moment(currentDate).endOf("day").format("YYYY-MM-DD");
            }

            const url = `/api/appointments?start=${start}&end=${end}&limit=1000`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                const formattedEvents = data.data
                    .filter((apt: any) => apt.customer)
                    .map((apt: any) => {
                        const aptDate = moment(apt.date).format("YYYY-MM-DD");

                        const customerName =
                            typeof apt.customer === 'string'
                                ? apt.customer
                                : apt.customer?.name || 'Unknown Customer';

                        const staffName =
                            typeof apt.staff === 'string'
                                ? apt.staff
                                : apt.staff?.name || 'Unassigned';

                        const staffId =
                            typeof apt.staff === 'string'
                                ? apt.staff
                                : apt.staff?._id || "unassigned";

                        return {
                            id: apt._id,
                            title: `${customerName} (${staffName})`,
                            start: moment(`${aptDate} ${apt.startTime}`, "YYYY-MM-DD HH:mm").toDate(),
                            end: moment(`${aptDate} ${apt.endTime}`, "YYYY-MM-DD HH:mm").toDate(),
                            resourceId: staffId,
                            status: apt.status,
                            customer: customerName,
                            staffName: staffName,
                            services: (apt.services || [])
                                .map((s: any) => typeof s === 'string' ? s : s?.name || 'Unknown Service')
                                .filter(Boolean)
                        };
                    });
                setEvents(formattedEvents);
            }
        } catch (error) {
            console.error("Error fetching appointments for calendar:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    useEffect(() => {
        fetchAppointments(date, view);
    }, [date, view, refreshTrigger, fetchAppointments]);

    const handleNavigate = (newDate: Date) => {
        setDate(newDate);
    };

    const handleViewChange = (newView: View) => {
        setView(newView);
    };

    const scrollToTime = useMemo(() => {
        let h = 8, m = 0;
        if (settings?.bookingRules?.shift1?.start) {
            const [sh, sm] = settings.bookingRules.shift1.start.split(':').map(Number);
            h = sh; m = sm;
        }
        return moment().set({ h, m, s: 0, ms: 0 }).toDate();
    }, [settings]);

    const minTime = useMemo(() => {
        let h = 8, m = 0;
        if (settings?.bookingRules?.shift1?.start) {
            const [sh, sm] = settings.bookingRules.shift1.start.split(':').map(Number);
            h = sh; m = sm;
        }
        return moment().set({ h, m, s: 0, ms: 0 }).toDate();
    }, [settings]);

    const maxTime = useMemo(() => {
        let h = 18, m = 0;
        if (settings?.bookingRules?.shift2?.end) {
            const [eh, em] = settings.bookingRules.shift2.end.split(':').map(Number);
            h = eh; m = em;
        } else if (settings?.bookingRules?.shift1?.end) {
            const [eh, em] = settings.bookingRules.shift1.end.split(':').map(Number);
            h = eh; m = em;
        } else {
            h = 22; m = 0;
        }
        return moment().set({ h, m, s: 0, ms: 0 }).toDate();
    }, [settings]);

    // Định nghĩa custom component để hiển thị thêm services vào event
    const calendarComponents = useMemo(() => ({
        event: ({ event }: { event: Event }) => (
            <div className="flex flex-col h-full overflow-hidden leading-tight">
                <span className="font-semibold truncate">{event.title}</span>
                {event.services && event.services.length > 0 && (
                    <span
                        className="text-[10px] opacity-90 truncate mt-[2px]"
                        title={event.services.join(", ")}
                    >
                        {event.services.join(", ")}
                    </span>
                )}
            </div>
        )
    }), []);

    const eventStyleGetter = (event: Event) => {
        let backgroundColor = "#3b82f6"; // Default blue
        if (event.status === "completed") backgroundColor = "#10b981"; // Green
        if (event.status === "pending") backgroundColor = "#f59e0b"; // Amber
        if (event.status === "cancelled") backgroundColor = "#ef4444"; // Red

        return {
            style: {
                backgroundColor,
                borderRadius: "6px",
                opacity: 0.9,
                color: "white",
                border: "none",
                display: "block",
                padding: "2px 6px",
                fontSize: "11px",
                fontWeight: "600",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                transition: "transform 0.1s ease",
            },
        };
    };

    return (
        <div className="h-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">{view}ly Schedule</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage appointments across staff members</p>
                </div>
                <button
                    onClick={() => fetchAppointments(date, view)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
                <Calendar
                    localizer={localizer}
                    events={events}
                    resources={view === Views.DAY ? resources : undefined}
                    resourceIdAccessor="id"
                    resourceTitleAccessor="title"
                    startAccessor="start"
                    endAccessor="end"
                    view={view}
                    date={date}
                    onNavigate={handleNavigate}
                    onView={handleViewChange}
                    views={[Views.DAY, Views.WEEK, Views.MONTH]}
                    step={30}
                    timeslots={2}
                    min={minTime}
                    max={maxTime}
                    scrollToTime={scrollToTime}
                    eventPropGetter={eventStyleGetter}
                    onSelectEvent={onSelectEvent}
                    className="rbc-calendar-premium"
                    messages={{
                        noEventsInRange: "No appointments scheduled for this period",
                    }}
                    components={calendarComponents}
                    dayLayoutAlgorithm="no-overlap"
                />
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold py-2 px-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
                <span className="text-gray-400 dark:text-gray-500 uppercase tracking-wider">Legend:</span>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-gray-600 dark:text-gray-300">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary-500"></span>
                    <span className="text-gray-600 dark:text-gray-300">Confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-gray-600 dark:text-gray-300">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-gray-600 dark:text-gray-300">Cancelled</span>
                </div>
            </div>

            <style jsx global>{`
                /* ====== LIGHT MODE ====== */
                .rbc-calendar-premium {
                    font-family: inherit;
                    background: white;
                }
                .rbc-header {
                    padding: 14px 0;
                    font-weight: 700;
                    color: #374151;
                    background-color: #f8fafc;
                    border-bottom: 2px solid #e2e8f0;
                    font-size: 13px;
                }
                .rbc-toolbar {
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .rbc-toolbar-label {
                    font-size: 1.125rem;
                    font-weight: 800;
                    color: #1e293b;
                    flex: 1;
                }
                .rbc-btn-group {
                    background: #f1f5f9;
                    padding: 4px;
                    border-radius: 12px;
                    border: none;
                }
                .rbc-toolbar button {
                    color: #64748b;
                    border: none;
                    background: transparent;
                    padding: 6px 16px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .rbc-toolbar button:hover {
                    background-color: rgba(255,255,255,0.6);
                    color: #1e293b;
                }
                .rbc-toolbar button.rbc-active {
                    background-color: white !important;
                    color: #1e3a8a !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                .rbc-time-view {
                    border: none;
                }
                .rbc-timeslot-group {
                    border-bottom: 1px solid #f1f5f9;
                    min-height: 50px;
                }
                .rbc-time-content {
                    border-top: 2px solid #e2e8f0;
                }
                .rbc-time-gutter .rbc-timeslot-group {
                    border: none;
                }
                .rbc-label {
                    padding: 0 12px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #94a3b8;
                }
                .rbc-event {
                    padding: 2px 4px;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .rbc-event:hover {
                    z-index: 50 !important;
                    transform: scale(1.02);
                }
                .rbc-current-time-indicator {
                    height: 2px;
                    background-color: #ef4444;
                }
                .rbc-current-time-indicator::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: -4px;
                    width: 10px;
                    height: 10px;
                    background: #ef4444;
                    border-radius: 50%;
                }
                .rbc-month-view {
                    border: none;
                    background: #f8fafc;
                }
                .rbc-month-row {
                    background: white;
                    margin-bottom: 2px;
                }
                .rbc-day-bg + .rbc-day-bg {
                    border-left: 1px solid #f1f5f9;
                }
                .rbc-today {
                    background-color: #eff6ff;
                }
                .rbc-show-more {
                    font-weight: 700;
                    color: #2563eb;
                    background: #f1f5f9;
                    border-radius: 4px;
                    font-size: 10px;
                    padding: 2px 4px;
                }
                .rbc-time-slot {
                    border-top: none;
                }
                .rbc-day-slot .rbc-time-slot {
                    border-top: 1px solid #f1f5f9;
                }
                .rbc-off-range-bg {
                    background: #f8fafc;
                }
                .rbc-off-range {
                    color: #cbd5e1;
                }
                .rbc-date-cell {
                    color: #374151;
                    font-weight: 600;
                }
                .rbc-date-cell.rbc-now {
                    color: #1e3a8a;
                }
                .rbc-row-content {
                    background: white;
                }
                .rbc-allday-cell {
                    background: #f8fafc;
                }

                /* ====== DARK MODE OVERRIDES ====== */
                .dark .rbc-calendar-premium {
                    background: #0f172a;
                    color: #e2e8f0;
                }
                .dark .rbc-header {
                    color: #cbd5e1;
                    background-color: #1e293b;
                    border-bottom: 2px solid #334155;
                }
                .dark .rbc-toolbar-label {
                    color: #f1f5f9;
                }
                .dark .rbc-btn-group {
                    background: #1e293b;
                }
                .dark .rbc-toolbar button {
                    color: #94a3b8;
                }
                .dark .rbc-toolbar button:hover {
                    background-color: var(--color-primary-900) !important;
                    color: #fff !important;
                }
                .dark .rbc-toolbar button.rbc-active {
                    background-color: var(--color-primary-900) !important;
                    color: #fff !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                .dark .rbc-time-view,
                .dark .rbc-month-view,
                .dark .rbc-agenda-view {
                    background: #0f172a;
                    border-color: #334155;
                }
                .dark .rbc-timeslot-group {
                    border-bottom: 1px solid #1e293b;
                }
                .dark .rbc-time-content {
                    border-top: 2px solid #334155;
                    background: #0f172a;
                }
                .dark .rbc-time-gutter {
                    background: #0f172a;
                }
                .dark .rbc-label {
                    color: #475569;
                }
                .dark .rbc-time-slot {
                    border-top: none;
                }
                .dark .rbc-day-slot .rbc-time-slot {
                    border-top: 1px solid #1e293b;
                }
                .dark .rbc-day-slot .rbc-time-column {
                    background: #0f172a;
                }
                .dark .rbc-today {
                    background-color: #172554;
                }
                .dark .rbc-off-range-bg {
                    background: #1e293b;
                }
                .dark .rbc-off-range {
                    color: #334155;
                }
                .dark .rbc-date-cell {
                    color: #94a3b8;
                }
                .dark .rbc-date-cell.rbc-now {
                    color: #93c5fd;
                }
                .dark .rbc-month-row {
                    background: #0f172a;
                    border-color: #1e293b;
                }
                .dark .rbc-month-row + .rbc-month-row {
                    border-top: 1px solid #1e293b;
                }
                .dark .rbc-day-bg + .rbc-day-bg {
                    border-left: 1px solid #1e293b;
                }
                .dark .rbc-row-content {
                    background: #0f172a;
                }
                .dark .rbc-allday-cell {
                    background: #1e293b;
                }
                .dark .rbc-show-more {
                    color: #93c5fd;
                    background: #1e293b;
                }
                .dark .rbc-row-bg .rbc-today {
                    background-color: #172554;
                }
                .dark .rbc-header.rbc-today {
                    background-color: #1e3a8a;
                    color: #bfdbfe;
                }
                .dark .rbc-agenda-view table {
                    background: #0f172a;
                    color: #e2e8f0;
                    border-color: #334155;
                }
                .dark .rbc-agenda-date-cell,
                .dark .rbc-agenda-time-cell,
                .dark .rbc-agenda-event-cell {
                    border-color: #1e293b;
                    color: #cbd5e1;
                }
                .dark .rbc-row-segment .rbc-event-content {
                    color: white;
                }
                .dark .rbc-time-header {
                    background: #1e293b;
                    border-color: #334155;
                }
                .dark .rbc-time-header-content {
                    border-left: 1px solid #334155;
                }
                .dark .rbc-time-header-gutter {
                    background: #1e293b;
                }
                .dark .rbc-day-slot .rbc-events-container {
                    margin-right: 10px;
                }
                .dark .rbc-event {
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .dark .rbc-current-time-indicator {
                    background-color: #f87171;
                }
                .dark .rbc-current-time-indicator::before {
                    background: #f87171;
                }
            `}</style>
        </div>
    );
}
