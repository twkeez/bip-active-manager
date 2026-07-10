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
        @page { size: letter; margin: 0.5in; }
        html, body { background: #fff; }
        /* Force the gradient header + colored cards to print (browsers strip backgrounds by default). */
        .report-print-target, .report-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .no-print { display: none !important; }
          /* Let large sections flow across pages so they fill the page instead of
             jumping whole to the next one (which left big blank gaps). */
          .report-print-target section { break-inside: auto !important; }
          /* …but never split a card, table row, or the header banner internally. */
          .report-print-target header,
          .report-print-target .rounded-xl,
          .report-print-target .rounded-2xl,
          .report-print-target tr { break-inside: avoid; }
          /* Keep a section heading with the content that follows it. */
          .report-print-target h2, .report-print-target h3 { break-after: avoid; }
        }
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
