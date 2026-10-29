"use client";
import { useEffect, type ReactNode } from "react";

/** Toolbar and print styles around the audit report; opens the print dialog once the page has drawn. */
export default function ReportPrintShell({ title, warnings = [], children }: { title: string; warnings?: string[]; children: ReactNode }) {
  // A report that may be about the wrong practice doesn't open the print dialog by itself.
  const blocked = warnings.length > 0;
  useEffect(() => {
    document.title = title;
    if (blocked) return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [title, blocked]);

  return (
    <>
      <style>{`
        /* No page margin, so the browser has nowhere to stamp its own header
           and footer; the report carries the margin itself on every page. */
        @page { size: letter; margin: 0; }
        html, body { background: #fff; }
        .report-print-target, .report-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .report-print-target {
            box-sizing: border-box;
            padding: calc(0.5in + 0.5rem) !important;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      {blocked && (
        <div className="no-print mx-auto mt-4 max-w-3xl rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Check before sending: this audit may be mixing up different practices.</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Running the steps again won&apos;t fix it. Correct the client record if needed, then start a new audit.</p>
        </div>
      )}
      <div className="no-print mx-auto flex max-w-3xl items-center justify-between gap-4 px-8 pt-4">
        <p className="text-xs text-gray-500">
          Choose <strong>Save as PDF</strong> to share it. In Safari, untick <strong>Print headers and footers</strong>.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Print / Save as PDF
        </button>
      </div>
      <div className="report-print-target bg-white px-8 py-8">{children}</div>
    </>
  );
}
