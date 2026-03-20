"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Printer, ArrowLeft, Scissors } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import { getCurrencySymbol } from "@/lib/currency";

export default function PrintInvoicePage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [invRes, settingsRes, depositsRes] = await Promise.all([
                    fetch(`/api/invoices/${id}`),
                    fetch("/api/settings"),
                    fetch(`/api/deposits?invoiceId=${id}`)
                ]);
                const invData = await invRes.json();
                const settingsData = await settingsRes.json();
                const depositsData = await depositsRes.json();

                if (invData.success) setInvoice(invData.data);
                if (settingsData.success) setSettings(settingsData.data);
                if (depositsData.success) setDeposits(depositsData.data);
            } catch (error) {
                console.error("Error fetching print data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">Loading receipt...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    const currencySymbol = getCurrencySymbol(settings?.currency || 'USD');

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white text-black">
            {/* Header / Controls */}
            <div className="max-w-[400px] mx-auto flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <FormButton
                    onClick={handlePrint}
                    icon={<Printer className="w-4 h-4" />}
                >
                    Print Receipt
                </FormButton>
            </div>

            {/* Thermal Receipt Content */}
            <div className="max-w-[380px] mx-auto bg-white p-6 shadow-xl print:shadow-none print:w-full font-mono text-sm border-t-8 border-blue-900 print:border-t-0">
                {/* Store Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-tighter mb-1">{settings?.storeName || "SALON POS"}</h1>
                    <p className="text-[11px] text-gray-500 uppercase">{settings?.address || "123 Beauty Lane, Salon City"}</p>
                    <p className="text-[11px] text-gray-500">TEL: {settings?.phone || "000-000-0000"}</p>
                    <div className="mt-4 border-y border-dashed border-gray-300 py-2">
                        <p className="font-bold text-lg">TAX RECEIPT</p>
                    </div>
                </div>

                {/* Info Block */}
                <div className="space-y-1 mb-6 text-[12px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Receipt No:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span>{format(new Date(invoice.date), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Customer:</span>
                        <span className="font-bold">{invoice.customer?.name || "Walk-in"}</span>
                    </div>
                    {invoice.appointment && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="text-indigo-600 font-bold uppercase">Appointment</span>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full mb-6 border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-100 text-[10px] text-left text-gray-500 uppercase tracking-wider">
                            <th className="py-2 font-semibold">Item Desc</th>
                            <th className="py-2 font-semibold text-center">Qty</th>
                            <th className="py-2 font-semibold text-right">Price</th>
                            <th className="py-2 font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-gray-200">
                        {invoice.items.map((item: any, idx: number) => (
                            <tr key={idx} className="text-[12px]">
                                <td className="py-2 align-top">
                                    <span className="font-medium">{item.name}</span>
                                    {item.discount > 0 && <p className="text-[9px] text-red-500">Disc: -{currencySymbol}{item.discount.toFixed(2)}</p>}
                                    {item.itemModel === 'Service' && <p className="text-[9px] text-gray-400">Professional Service</p>}
                                </td>
                                <td className="py-2 text-center align-top">{item.quantity}</td>
                                <td className="py-2 text-right align-top">{currencySymbol}{item.price.toFixed(2)}</td>
                                <td className="py-2 text-right align-top font-bold">{currencySymbol}{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary Section */}
                <div className="border-t border-gray-100 pt-4 space-y-2 text-[13px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{currencySymbol}{invoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                        <span>Tax ({((invoice.tax / invoice.subtotal) * 100).toFixed(0)}%)</span>
                        <span>{currencySymbol}{invoice.tax.toFixed(2)}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Discount</span>
                            <span>-{currencySymbol}{invoice.discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-2 border-t-2 border-double border-gray-900 text-lg font-black uppercase">
                        <span>Grand Total</span>
                        <span>{currencySymbol}{invoice.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>Net Paid</span>
                        <span>{currencySymbol}{invoice.amountPaid.toFixed(2)}</span>
                    </div>
                    {invoice.totalAmount - invoice.amountPaid > 0 && (
                        <div className="flex justify-between text-red-600 font-bold border-t border-dashed border-red-100 mt-1 pt-1">
                            <span>Balance Due</span>
                            <span>{currencySymbol}{(invoice.totalAmount - invoice.amountPaid).toFixed(2)}</span>
                        </div>
                    )}
                </div>

                {/* Payment History */}
                {deposits.length > 0 && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment History</p>
                        <div className="space-y-2">
                            {deposits.map((dep, idx) => (
                                <div key={idx} className="flex justify-between text-[11px]">
                                    <div className="text-gray-500">
                                        <span>{format(new Date(dep.date), "dd/MM/yy HH:mm")}</span>
                                        <span className="mx-2">•</span>
                                        <span className="uppercase">{dep.paymentMethod}</span>
                                    </div>
                                    <span className="font-bold">{currencySymbol}{dep.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Section */}
                <div className="mt-10 text-center space-y-4">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payment Method</p>
                        <p className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">{invoice.paymentMethod || 'Cash'}</p>
                    </div>

                    <div className="pt-6 relative">
                        <div className="absolute top-0 left-0 w-full border-t border-dashed border-gray-300"></div>
                        <Scissors className="w-4 h-4 text-gray-300 absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-1" />
                        <p className="text-[11px] font-bold text-gray-900 mt-4 leading-relaxed">
                            THANK YOU FOR CHOOSING {settings?.storeName || "US"}!<br />
                            PLEASE VISIT AGAIN.
                        </p>
                        <p className="text-[9px] text-gray-400 mt-2 italic">Prices inclusive of taxes where applicable</p>
                    </div>

                    <div className="pt-4 flex justify-center opacity-20">
                        {/* Placeholder for barcode-like aesthetic */}
                        <div className="flex gap-px h-8 bg-gray-900 w-full max-w-[200px]"></div>
                    </div>
                    <p className="text-[8px] text-gray-300 tracking-[4px] uppercase">{invoice.invoiceNumber}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                }
            `}</style>
        </div>
    );
}
