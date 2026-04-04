"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react"; // Lấy session người dùng
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Calendar, RefreshCcw } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { useSettings } from "@/components/providers/SettingsProvider";
import { getMonthDateRangeInTimezone } from "@/lib/dateUtils";

export default function FinancialReportPage() {
    const { data: session } = useSession();
    const currentUserIsAdmin = session?.user?.isAdmin === true; // Xác định quyền Admin

    const { settings } = useSettings();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => getMonthDateRangeInTimezone(settings.timezone || "UTC"));
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        setDateRange(getMonthDateRangeInTimezone(settings.timezone || "UTC"));
    }, [settings.timezone]);

    // Tự động tải lại báo cáo khi ngày tháng, cài đặt hoặc quyền hạn thay đổi
    useEffect(() => {
        fetchReport();
    }, [dateRange, settings, currentUserIsAdmin]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });

            // 🔴 LOGIC LỌC: Nếu không phải Admin, chỉ lấy dữ liệu của QR thứ 2
            if (!currentUserIsAdmin) {
                if (settings?.qrCodes && settings.qrCodes.length > 1) {
                    const secondQr = settings.qrCodes[1]; // Lấy QR thứ 2 (Index = 1)
                    query.append('qrAccount', secondQr.accountNumber);
                } else {
                    // Nếu Staff vào mà chưa có QR thứ 2, gửi cờ chặn bảo mật
                    query.append('qrAccount', 'RESTRICTED_ACCESS_NO_QR_FOUND');
                }
            }

            const res = await fetch(`/api/reports/financial?${query.toString()}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        const val = amount || 0;
        return `${settings.symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="p-6 min-h-screen bg-gray-50 text-black">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Báo cáo Tài chính</h1>
                        <p className="text-gray-500 text-sm">
                            {currentUserIsAdmin ? "Tổng quan thu chi toàn hệ thống" : "Báo cáo doanh thu theo mã QR được chỉ định"}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase px-2">Từ</span>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                className="border-none bg-gray-50 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-900/20 py-1.5 px-3"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase px-2">Đến</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                className="border-none bg-gray-50 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-900/20 py-1.5 px-3"
                            />
                        </div>
                        <FormButton onClick={fetchReport} loading={loading} variant="ghost" className="p-2" title="Làm mới dữ liệu">
                            <RefreshCcw className="w-4 h-4" />
                        </FormButton>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Lợi nhuận */}
                            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                                <TrendingUp className="absolute top-0 right-0 p-4 w-24 h-24 opacity-10" />
                                <div className="relative z-10">
                                    <p className="text-blue-200 font-medium mb-1">Lợi nhuận ròng</p>
                                    <h3 className="text-3xl font-bold mb-4">{formatCurrency(data.netProfit)}</h3>
                                    <div className="text-xs bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                                        Doanh thu - (Nhập hàng + Chi phí)
                                    </div>
                                </div>
                            </div>

                            {/* Doanh thu */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative group hover:border-blue-900/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                        <DollarSign className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-gray-400 uppercase">Tổng doanh số</p>
                                        <p className="text-sm font-medium text-emerald-600">Thực thu: {formatCurrency(data.sales.totalCollected)}</p>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(data.sales.totalSales)}</h3>
                                <p className="text-sm text-gray-500">{data.sales.count} Hóa đơn</p>
                            </div>

                            {/* Dòng tiền */}
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative group hover:border-blue-900/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                                        <CreditCard className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="text-right"><p className="text-xs font-semibold text-gray-400 uppercase">Dòng tiền mặt</p></div>
                                </div>
                                <h3 className={`text-2xl font-bold mb-1 ${data.cashFlow >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                    {formatCurrency(data.cashFlow)}
                                </h3>
                                <p className="text-sm text-gray-500">Tiền mặt thực tế vào - ra</p>
                            </div>
                        </div>

                        {/* Chỉ hiện chi phí chi tiết nếu là Admin */}
                        {currentUserIsAdmin && (
                            <>
                                <h2 className="text-lg font-bold text-gray-900 pt-4">Phân tích chi tiêu</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-orange-50 rounded-xl"><ShoppingBag className="w-6 h-6 text-orange-600" /></div>
                                            <p className="text-xs font-semibold text-gray-400 uppercase">Nhập hàng</p>
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(data.purchases.totalPurchases)}</h3>
                                        <p className="text-sm text-gray-500">Đã trả: {formatCurrency(data.purchases.totalPaid)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-red-50 rounded-xl"><TrendingDown className="w-6 h-6 text-red-600" /></div>
                                            <p className="text-xs font-semibold text-gray-400 uppercase">Chi phí vận hành</p>
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(data.expenses.totalExpenses)}</h3>
                                        <p className="text-sm text-gray-500">{data.expenses.count} Bản ghi chi phí</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-500">Không tìm thấy dữ liệu trong khoảng thời gian này.</div>
                )}
            </div>
        </div>
    );
}