"use client";
import { useEffect } from "react";
import ClientExpectationsDocument from "@/components/onboarding/client-expectations-document";
import type { ClientExpectationsModel } from "@/lib/onboarding/load-client-expectations";

export default function ClientExpectationsPrintClient({
  model,
  generatedAt,
}: {
  model: ClientExpectationsModel;
  generatedAt: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        /* No page margin, so Chrome and Edge have nowhere to stamp their own
           header and footer (date, page title, URL, "1/6"); the document
           carries the margin itself, repeated on every printed page. */
        @page { size: letter; margin: 0; }
        html, body { background: #fff; }
        .report-print-target, .report-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .report-print-target {
            box-sizing: border-box;
            padding: calc(0.5in + 2rem) !important; /* the old page margin plus the document's own px-8 py-8 */
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
          }
          .no-print { display: none !important; }
          .report-print-target section { break-inside: avoid; }
          .report-print-target h1, .report-print-target h2 { break-after: avoid; }
        }
      `}</style>
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between gap-4 px-8 pt-4">
        {/* Chrome and Edge leave their header and footer off now (see @page
            above). Safari ignores that, so the reminder stays for it. */}
        <p className="text-xs text-gray-500">
          Chrome and Edge print without the date and web address. In Safari, untick{" "}
          <strong>Print headers and footers</strong> in the print dialog.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Print / Save as PDF
        </button>
      </div>
      <ClientExpectationsDocument model={model} generatedAt={generatedAt} />
    </>
  );
}
