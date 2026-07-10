"use client";
import { useEffect } from "react";
import ReportPreview from "@/components/reports/report-preview";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportConfig } from "@/lib/reporting/report-config-types";
import type { ReportDraft } from "@/lib/reporting/draft-types";

export default function ReportPrintClient({
  report,
  config,
  draft,
}: {
  report: ClientReportModel;
  config: ReportConfig;
  draft: ReportDraft | null;
}) {
  useEffect(() => {
    // Give fonts/layout a beat to settle, then open the print dialog.
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @page { size: A4; margin: 10mm; }
        html, body { background: #fff; }
        /* Force the gradient header + colored cards to print (browsers strip backgrounds by default). */
        .report-print-target, .report-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print { .no-print { display: none !important; } }
      `}</style>
      <div className="no-print mx-auto flex max-w-4xl justify-end px-8 pt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Print / Save as PDF
        </button>
      </div>
      <ReportPreview report={report} config={config} draft={draft} printMode />
    </>
  );
}
