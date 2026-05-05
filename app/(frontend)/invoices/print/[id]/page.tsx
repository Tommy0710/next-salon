import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { getInvoicePrintData } from "@/lib/invoice-print";
import PrintActions from "./PrintActions";
import PrintStyles from "./PrintStyles";

export default async function PrintInvoicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { invoice, settings } = await getInvoicePrintData(id);

    if (!invoice) notFound();

    const currency: string = settings?.currency || "VND";
    const fmt = (n: number) => formatCurrency(n, currency);

    // All derived values computed once on the server
    const taxPct =
        invoice.subtotal > 0
            ? ((invoice.tax / invoice.subtotal) * 100).toFixed(0)
            : "0";
    const discountPct =
        invoice.subtotal > 0
            ? Math.round((invoice.discount / invoice.subtotal) * 100)
            : 0;
    const walletUsed: number = invoice.walletUsed || 0;

    const defaultQr = settings?.qrCodes?.[0];
    const qrSource: string = invoice.qrCodeImage || defaultQr?.image || "";
    const bankDetailsRaw: string =
        invoice.bankDetails ||
        (defaultQr
            ? `${defaultQr.bankName} | ${defaultQr.accountNumber} | ${defaultQr.name}`
            : "");
    const bankParts = bankDetailsRaw.split("|").map((s: string) => s.trim());

    const isCash =
        invoice.paymentMethod === "Tiền mặt" ||
        invoice.paymentMethod?.toLowerCase().includes("cash");
    const isCard =
        invoice.paymentMethod === "Cà thẻ" ||
        invoice.paymentMethod?.toLowerCase().includes("card");
    const showQr =
        !!qrSource && !isCash && !isCard &&
        (invoice.paymentMethod === "Mã QR" || invoice.status !== "paid");

    // Pre-format all item values — no formatCurrency in render loop
    const formattedItems = (invoice.items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: fmt(item.price),
        total: fmt(item.total),
        discount: item.discount > 0 ? fmt(item.discount) : null,
    }));

    const formattedDate = format(new Date(invoice.date), "dd/MM/yyyy HH:mm");

    return (
        <div className="min-h-screen bg-gray-100 py-4 md:p-8 print:p-0 print:bg-white dark:bg-slate-900 text-black">
            {/* Client island — only buttons are interactive */}
            <PrintActions
                invoiceId={id}
                invoiceStatus={invoice.status}
                invoiceNumber={invoice.invoiceNumber}
                totalAmount={invoice.totalAmount}
                invoicePaymentMethod={invoice.paymentMethod}
                customerPhone={invoice.customer?.phone}
                customerName={invoice.customer?.name}
                showQr={showQr}
                itemNames={(invoice.items || []).map((i: any) => i.name)}
            />

            {/* Thermal Receipt — 80mm, static HTML, zero JS */}
            <div id="print-area" className="w-[80mm] mx-auto bg-white text-sm p-[4mm] box-border">

                {/* Store Header */}
                <div className="text-center mb-2 p-4">
                    {settings?.logoUrl && (
                        <div className="w-full h-16 overflow-hidden">
                            <Image
                                src={settings.logoUrl}
                                alt="Store Logo"
                                width={112}
                                height={64}
                                unoptimized
                                className="object-cover mx-auto"
                            />
                        </div>
                    )}
                    <p className="text-[11px] text-gray-500 uppercase">
                        {settings?.address || "123 Beauty Lane, Salon City"}
                    </p>
                    <p className="text-[11px] text-gray-500">
                        SĐT: {settings?.phone || "000-000-0000"}
                    </p>
                </div>

                {/* Invoice Info */}
                <div className="space-y-1 mb-4 text-[12px]">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Số biên lai:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Ngày:</span>
                        <span>{formattedDate}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Khách hàng:</span>
                        <span className="font-bold">
                            {invoice.customer?.name || "Khách vãng lai"}
                        </span>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 text-[11px] text-gray-500 uppercase">
                            <th className="py-2 text-center font-semibold w-[50px]">SL</th>
                            <th className="py-2 text-right font-semibold w-[80px]">Giá</th>
                            <th className="py-2 text-right font-semibold w-[90px]">Tổng</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {formattedItems.map((item: any, idx: number) => (
                            <tr key={idx} className="align-top">
                                <td colSpan={3} className="py-2">
                                    <div className="flex justify-between items-center">
                                        <span className="w-[50px] text-center text-gray-700">
                                            {item.quantity}
                                        </span>
                                        <span className="w-[80px] text-right text-gray-600">
                                            {item.price}
                                        </span>
                                        <span className="w-[90px] text-right font-semibold text-gray-900">
                                            {item.total}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-800 leading-snug">
                                        {item.name}
                                    </div>
                                    {item.discount && (
                                        <div className="text-[11px] text-red-500">
                                            -{item.discount}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary */}
                <div className="border-t border-gray-100 pt-4 space-y-2 text-[13px]">
                    <div className="flex justify-between text-gray-700">
                        <span>Thuế ({taxPct}%)</span>
                        <span>{fmt(invoice.tax)}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Chiết khấu ({discountPct}%)</span>
                            <span>-{fmt(invoice.discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-md font-black uppercase">
                        <span>Tổng cộng</span>
                        <span>{fmt(invoice.totalAmount)}</span>
                    </div>
                    {walletUsed > 0 && (
                        <>
                            <div className="flex justify-between text-emerald-700">
                                <span>Ví sử dụng</span>
                                <span>-{fmt(walletUsed)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>Còn thanh toán</span>
                                <span>{fmt(Math.max(0, invoice.totalAmount - walletUsed))}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 text-center space-y-4">
                    {showQr && qrSource && (
                        <div className="flex flex-col items-center">
                            <Image
                                src={qrSource}
                                alt="QR Code Payment"
                                width={160}
                                height={160}
                                unoptimized
                                className="object-contain p-1 border border-gray-200 rounded-lg"
                            />
                            {bankParts.length > 0 && bankParts[0] && (
                                <div className="text-[10px] text-center mt-2 space-y-0.5">
                                    <p className="font-bold text-[11px]">{bankParts[0]}</p>
                                    {bankParts[1] && (
                                        <p className="text-[12px] font-black">{bankParts[1]}</p>
                                    )}
                                    {bankParts[2] && (
                                        <p className="text-gray-500">{bankParts[2]}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-2">
                        <p className="text-[11px] font-bold text-gray-900 mt-4 leading-relaxed">
                            CẢM ƠN BẠN ĐÃ CHỌN {settings?.storeName || "CHÚNG TÔI"}!
                            <br />
                            HẸN GẶP LẠI.
                        </p>
                    </div>
                </div>
            </div>

            <PrintStyles />
        </div>
    );
}
