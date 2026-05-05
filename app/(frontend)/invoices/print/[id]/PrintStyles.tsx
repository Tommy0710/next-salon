"use client";

export default function PrintStyles() {
    return (
        <style jsx global>{`
            @media print {
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                html, body {
                    width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background-color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                header, nav, footer, .print\\:hidden {
                    display: none !important;
                }
                #print-area {
                    width: 80mm !important;
                    margin: 0 !important;
                    padding: 4mm !important;
                    box-shadow: none !important;
                    page-break-after: auto;
                }
                #print-area .border-gray-100,
                #print-area .border-gray-200,
                #print-area .border-gray-300,
                #print-area .border-gray-400 {
                    border-color: #000 !important;
                }
                #print-area * {
                    color: #000 !important;
                    background: transparent !important;
                }
            }
        `}</style>
    );
}
