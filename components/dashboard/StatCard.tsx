import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    color: "blue" | "green" | "purple" | "orange" | "red";
}

const colorMap = {
    blue: "bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-400",
    green: "bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400",
    purple: "bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400",
    orange: "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400",
    red: "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400",
};

export default function StatCard({ title, value, icon: Icon, trend, trendUp, color }: StatCardProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
                </div>
                <div className={`p-3 rounded-lg ${colorMap[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center text-sm">
                    <span className={`font-medium ${trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {trendUp ? "+" : ""}{trend}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 ml-2">from last month</span>
                </div>
            )}
        </div>
    );
}
