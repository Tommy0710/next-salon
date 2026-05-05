"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { FormButton } from "@/components/dashboard/FormInput";

interface PrintActionsProps {
    invoiceId: string;
    invoiceStatus: string;
    invoiceNumber: string;
    totalAmount: number;
    invoicePaymentMethod?: string;
    customerPhone?: string;
    customerName?: string;
    showQr: boolean;
    itemNames: string[];
}

export default function PrintActions({
    invoiceId,
    invoiceStatus,
    invoiceNumber,
    totalAmount,
    invoicePaymentMethod,
    customerPhone,
    customerName,
    showQr,
    itemNames,
}: PrintActionsProps) {
    const router = useRouter();
    const [actionLoading, setActionLoading] = useState(false);

    const handlePrint = useCallback(() => window.print(), []);

    const handleMarkAsPaid = useCallback(async () => {
        if (invoiceStatus === "paid" || actionLoading) return;
        if (!confirm("Xác nhận thanh toán thành công và gửi Zalo cảm ơn?")) return;

        setActionLoading(true);
        try {
            const paymentMethod = invoicePaymentMethod || (showQr ? "Mã QR" : "Tiền mặt");

            const res = await fetch(`/api/invoices/${invoiceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "paid", amountPaid: totalAmount, paymentMethod }),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error || "Cập nhật hóa đơn thất bại");

            // Fire-and-forget — Zalo does NOT block UI
            if (customerPhone) {
                fetch("/api/zalo/zns", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: customerPhone,
                        eventType: "checkout",
                        payloadData: {
                            customerName: customerName || "Quý khách",
                            invoiceId: invoiceNumber,
                            itemsName: itemNames.join(", "),
                        },
                    }),
                })
                    .then((r) => r.json())
                    .then((result) => {
                        if (!result.success) {
                            toast.error(
                                "Zalo gửi thất bại: " + (result.error || "Lỗi không xác định"),
                                { duration: 3000 }
                            );
                        }
                    })
                    .catch(() => toast.error("Zalo gửi thất bại."));
            }

            toast.success(customerPhone ? "Đã thanh toán và gửi Zalo cảm ơn." : "Đã thanh toán.");
            router.refresh();
        } catch (error: any) {
            toast.error(error?.message || "Không thể cập nhật trạng thái thanh toán");
        } finally {
            setActionLoading(false);
        }
    }, [invoiceId, invoiceStatus, totalAmount, invoicePaymentMethod, customerPhone, customerName, showQr, itemNames, router, actionLoading]);

    return (
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 print:hidden px-2">
            <button
                disabled={invoiceStatus !== "pending" || actionLoading}
                onClick={() => router.push(`/pos?edit=${invoiceId}`)}
                className={`flex items-center gap-2 text-sm transition-colors ${
                    invoiceStatus !== "pending"
                        ? "text-gray-300 cursor-not-allowed hidden"
                        : "text-gray-500 hover:text-gray-900 dark:text-white"
                }`}
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Chỉnh sửa hóa đơn</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <FormButton
                    onClick={handleMarkAsPaid}
                    loading={actionLoading}
                    disabled={invoiceStatus === "paid" || actionLoading}
                    className={`w-full sm:w-auto justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                        invoiceStatus === "paid"
                            ? "bg-green-600 hover:bg-green-600 text-white cursor-default"
                            : "bg-primary-900 hover:bg-primary-800 text-white"
                    }`}
                >
                    {invoiceStatus === "paid" ? "Đã thanh toán" : "Hoàn thành"}
                </FormButton>

                <FormButton
                    onClick={handlePrint}
                    icon={<Printer className="w-4 h-4" />}
                    className="w-full sm:w-auto justify-center gap-2 rounded-xl px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 dark:bg-slate-900 dark:border-gray-700"
                >
                    In biên lai
                </FormButton>
            </div>
        </div>
    );
}
