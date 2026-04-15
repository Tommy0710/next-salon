
"use client";

import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

import { useSettings } from "@/components/providers/SettingsProvider";

interface ServiceChartProps {
    data: {
        name: string;
        revenue: number;
    }[];
}

const COLORS = [
    '#1e3a8a', // blue-900
    '#2563eb', // blue-600
    '#3b82f6', // blue-500
    '#60a5fa', // blue-400
    '#93c5fd', // blue-300
    '#bfdbfe'  // blue-200
];

export default function ServiceChart({ data }: ServiceChartProps) {
    const { settings } = useSettings();
    const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);
    const displayData = sortedData.slice(0, 6);
    const remainingCount = Math.max(0, data.length - displayData.length);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Phân bổ doanh thu dịch vụ</h3>
                    <p className="text-sm text-gray-500 mt-1">Top dịch vụ theo doanh thu với nhãn dễ đọc.</p>
                </div>
                {remainingCount > 0 && (
                    <div className="text-right text-sm text-gray-500">
                        {remainingCount} more service{remainingCount > 1 ? 's' : ''} hidden
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={displayData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="revenue"
                            >
                                {displayData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                                formatter={(value: number) => [`${settings.symbol}${value.toLocaleString()}`, 'Revenue']}
                                labelFormatter={(label: string) => label}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-100 bg-slate-50 p-3">
                    <div className="space-y-2">
                        {displayData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                                <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <div className="min-w-0 grow">
                                    <div className="text-sm font-semibold text-slate-900 truncate" title={entry.name}>
                                        {entry.name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {settings.symbol}{entry.revenue.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
