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
    const [actionLoading, setActionLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>("");

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

    const currentStatus = invoice?.status;
    const dueAmount = invoice ? (invoice.totalAmount - invoice.amountPaid) : 0;

    const defaultQr = settings?.qrCodes?.[0];
    const qrSource = invoice?.qrCodeImage || defaultQr?.image;
    const bankDetailsSource = invoice?.bankDetails || (defaultQr ? `${defaultQr.bankName} | ${defaultQr.accountNumber} | ${defaultQr.name}` : "");
    const showQr = !!qrSource && (invoice?.paymentMethod === 'Mã QR' || currentStatus !== 'paid');

    const handleMarkAsPaid = async () => {
        if (!invoice || currentStatus === 'paid' || actionLoading) return;

        if (!confirm("Xác nhận thanh toán thành công và gửi Zalo cảm ơn?")) return;

        setActionLoading(true);
        setStatusMessage("");

        try {
            const paymentMethod = invoice.paymentMethod || (showQr ? 'Mã QR' : 'Tiền mặt');
            const updateBody: any = {
                status: 'paid',
                amountPaid: invoice.totalAmount,
                paymentMethod
            };

            const res = await fetch(`/api/invoices/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateBody),
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Cập nhật hóa đơn thất bại");
            }

            // Fetch lại invoice với đầy đủ thông tin customer
            const updatedRes = await fetch(`/api/invoices/${id}`);
            const updatedData = await updatedRes.json();
            let updatedInvoice;
            if (updatedData.success) {
                setInvoice(updatedData.data);
                updatedInvoice = updatedData.data;
            } else {
                setInvoice(data.data); // Fallback nếu fetch lại thất bại
                updatedInvoice = data.data;
            }

            const outstanding = updatedInvoice.totalAmount - updatedInvoice.amountPaid;
            if (outstanding > 0) {
                await fetch("/api/deposits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        invoice: updatedInvoice._id,
                        customer: updatedInvoice.customer?._id,
                        amount: outstanding,
                        paymentMethod: updatedInvoice.paymentMethod,
                        notes: "Thanh toán hoàn tất từ trang hóa đơn"
                    })
                });
            }

            if (updatedInvoice.customer?.phone) {
                const itemsName = (updatedInvoice.items || []).map((item: any) => item.name).join(', ');
                try {
                    const zaloResponse = await fetch("/api/zalo/zns", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            phone: updatedInvoice.customer.phone,
                            eventType: 'checkout',
                            payloadData: {
                                customerName: updatedInvoice.customer?.name || "Quý khách",
                                invoiceId: invoice.invoiceNumber,
                                itemsName: itemsName,
                            }
                        })
                    });
                    const zaloResult = await zaloResponse.json();
                    if (zaloResult.success) {
                        setStatusMessage("Cập nhật thành công: Đã thanh toán và gửi Zalo cảm ơn.");
                    } else {
                        setStatusMessage("Cập nhật thành công: Đã thanh toán. Zalo gửi thất bại: " + (zaloResult.error || "Lỗi không xác định"));
                    }
                } catch (zaloError) {
                    console.error("Zalo API error:", zaloError);
                    setStatusMessage("Cập nhật thành công: Đã thanh toán. Zalo gửi thất bại:");
                }
            } else {
                setStatusMessage("Cập nhật thành công: Đã thanh toán. Không có số điện thoại để gửi Zalo.");
            }
        } catch (error: any) {
            console.error("Error mark as paid:", error);
            alert(error?.message || "Không thể cập nhật trạng thái thanh toán");
            setStatusMessage("Lỗi: " + (error?.message || "Không thể cập nhật"));
        } finally {
            setActionLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">Đang tải biên lai...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Không tìm thấy hóa đơn</div>;

    const currencySymbol = getCurrencySymbol(settings?.currency || 'USD');

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white text-black">
            {/* Header / Controls */}
            <div className="max-w-[400px] mx-auto flex flex-col sm:flex-row gap-2 justify-between items-center mb-6 print:hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <FormButton
                        onClick={handleMarkAsPaid}
                        loading={actionLoading}
                        disabled={currentStatus === 'paid' || actionLoading}
                        className={`gap-2 ${currentStatus === 'paid' ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-900 hover:bg-blue-800'}`}
                    >
                        {currentStatus === 'paid' ? 'Đã thanh toán' : 'Hoàn thành'}
                    </FormButton>
                    <FormButton
                        onClick={handlePrint}
                        icon={<Printer className="w-4 h-4" />}
                    >
                        In Biên Lai
                    </FormButton>
                </div>
            </div>
            {statusMessage && (
                <div className="max-w-[400px] mx-auto text-sm text-blue-700 mb-4 print:hidden">{statusMessage}</div>
            )}

            {/* Thermal Receipt Content */}
            <div className="max-w-[380px] mx-auto bg-white p-6 shadow-xl print:shadow-none print:w-full  text-sm border-t-8 border-blue-900 print:border-t-0">
                {/* Store Header */}
                <div className="text-center mb-6">
                    {settings?.logoUrl && (
                        <div className="mb-4">
                            <img src={settings.logoUrl} alt="Store Logo" className="w-20 h-20 mx-auto object-contain" />
                        </div>
                    )}
                    {/* <h1 className="text-2xl font-bold uppercase tracking-tighter mb-1">{settings?.storeName || "SALON POS"}</h1>
                    <p className="text-[11px] text-gray-500 uppercase">{settings?.address || "123 Beauty Lane, Salon City"}</p>
                    <p className="text-[11px] text-gray-500">TEL: {settings?.phone || "000-000-0000"}</p> */}
                    {/* <div className="mt-4 border-y border-dashed border-gray-300 py-2">
                        <p className="font-bold text-lg">BIÊN LAI THUẾ</p>
                    </div> */}
                </div>

                {/* Info Block */}
                <div className="space-y-1 mb-6 text-[12px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Số biên lai:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Ngày:</span>
                        <span>{format(new Date(invoice.date), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Khách hàng:</span>
                        <span className="font-bold">{invoice.customer?.name || "Khách vãng lai"}</span>
                    </div>
                    {/* <div className="flex justify-between items-center">
                        <span className="text-gray-500">Trạng thái:</span>
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${invoice.status === 'paid' ? 'bg-green-50 text-green-700' : invoice.status === 'partially_paid' ? 'bg-blue-50 text-blue-700' : invoice.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            {invoice.status?.replace('_', ' ') || 'N/A'}
                        </span>
                    </div> */}
                    {invoice.appointment && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Loại:</span>
                            <span className="text-indigo-600 font-bold uppercase">Lịch hẹn</span>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-100 text-[10px] text-left text-gray-500 uppercase tracking-wider">
                            <th className="py-2 font-semibold">Mô tả mặt hàng</th>
                            <th className="py-2 font-semibold text-center">SL</th>
                            <th className="py-2 font-semibold text-right">Giá</th>
                            <th className="py-2 font-semibold text-right">Tổng</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-gray-200">
                        {invoice.items.map((item: any, idx: number) => (
                            <tr key={idx} className="text-[12px]">
                                <td className="py-2 align-top">
                                    <span className="font-medium">{item.name}</span>
                                    {item.discount > 0 && <p className="text-[9px] text-red-500">Giảm: -{currencySymbol}{item.discount.toFixed(2)}</p>}
                                    {item.itemModel === 'Service' && <p className="text-[9px] text-gray-400">Dịch vụ chuyên nghiệp</p>}
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
                        <span className="text-gray-500">Tổng phụ</span>
                        <span>{currencySymbol}{invoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                        <span>Thuế ({((invoice.tax / invoice.subtotal) * 100).toFixed(0)}%)</span>
                        <span>{currencySymbol}{invoice.tax.toFixed(2)}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Giảm giá</span>
                            <span>-{currencySymbol}{invoice.discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-2 border-t-2 border-double border-gray-900 text-lg font-black uppercase">
                        <span>Tổng cộng</span>
                        <span>{currencySymbol}{invoice.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700 font-bold">
                        <span>Đã thanh toán</span>
                        <span>{currencySymbol}{invoice.amountPaid.toFixed(2)}</span>
                    </div>
                    {invoice.totalAmount - invoice.amountPaid > 0 && (
                        <div className="flex justify-between text-red-600 font-bold border-t border-dashed border-red-100 mt-1 pt-1">
                            <span>Số dư còn lại</span>
                            <span>{currencySymbol}{(invoice.totalAmount - invoice.amountPaid).toFixed(2)}</span>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="mt-10 text-center space-y-4">
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Phương thức thanh toán</p>
                        <p className="font-bold text-sm bg-gray-100 px-3 py-1 rounded-full uppercase">{invoice.paymentMethod || 'Tiền mặt'}</p>
                    </div>

                    {/* THÊM KHỐI NÀY ĐỂ HIỂN THỊ MÃ QR */}
                    {showQr && qrSource && (
                        <div className="mt-6 flex flex-col items-center border-t border-dashed border-gray-300 pt-6">
                            <p className="text-[12px] font-black uppercase mb-2">Quét mã để thanh toán</p>
                            <img src={qrSource} alt="QR Code Payment" className="w-40 h-40 object-contain p-1 border border-gray-200 rounded-lg" />
                            {bankDetailsSource && (
                                <div className="text-[10px] text-center mt-2 space-y-0.5">
                                    <p className="font-bold text-[11px]">{bankDetailsSource.split('|')[0]}</p>
                                    <p className=" text-[12px] font-black">{bankDetailsSource.split('|')[1]}</p>
                                    <p className="text-gray-500">{bankDetailsSource.split('|')[2]}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-2 relative">
                        <div className="absolute top-0 left-0 w-full border-t border-dashed border-gray-300"></div>
                        <Scissors className="w-4 h-4 text-gray-300 absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-1" />
                        <p className="text-[11px] font-bold text-gray-900 mt-4 leading-relaxed">
                            CẢM ƠN BẠN ĐÃ CHỌN {settings?.storeName || "CHÚNG TÔI"}!<br />
                            HẸN GẶP LẠI.
                        </p>
                        {/* <p className="text-[9px] text-gray-400 mt-2 italic">Giá đã bao gồm thuế nếu áp dụng</p> */}
                    </div>

                    {/* <div className="pt-4 flex justify-center opacity-20">
                        <div className="flex gap-px h-8 bg-gray-900 w-full max-w-[200px]"></div>
                    </div> */}
                    {/* <p className="text-[8px] text-gray-300 tracking-[4px] uppercase">{invoice.invoiceNumber}</p> */}
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
