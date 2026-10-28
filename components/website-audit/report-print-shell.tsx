"use client";
import { useEffect, type ReactNode } from "react";

/** Toolbar and print styles around the audit report; opens the print dialog once the page has drawn. */
export default function ReportPrintShell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [title]);

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
