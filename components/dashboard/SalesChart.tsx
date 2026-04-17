"use client";
import { formatCurrency } from "@/lib/currency";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

import { useSettings } from "@/components/providers/SettingsProvider";

interface SalesChartProps {
    data: {
        name: string;
        sales: number;
    }[];
}

export default function SalesChart({ data }: SalesChartProps) {
    const { settings } = useSettings();
    const shouldRotate = data.length > 7;
    const formatXLabel = (label: string) => {
        if (!label) return '';
        return label.length > 15 ? `${label.slice(0, 15)}...` : label;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Sales Overview</h3>
                    <p className="text-sm text-gray-500 mt-1">Doanh thu theo thời gian, dễ đọc với nhãn gọn và tooltip rõ ràng.</p>
                </div>
                <div className="text-sm text-gray-500">
                    {data.length} point{data.length > 1 ? 's' : ''}
                </div>
            </div>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: shouldRotate ? 30 : 10,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            interval={0}
                            tickFormatter={formatXLabel}
                            angle={shouldRotate ? -35 : 0}
                            textAnchor={shouldRotate ? 'end' : 'middle'}
                            height={shouldRotate ? 50 : 30}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={(value) => formatCurrency(value, settings.currency)}
                            width={70}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [formatCurrency(value, settings.currency), 'Sales']}
                        />
                        <Area
                            type="monotone"
                            dataKey="sales"
                            stroke="#1e3a8a"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorSales)"
                            dot={{ r: 3 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
