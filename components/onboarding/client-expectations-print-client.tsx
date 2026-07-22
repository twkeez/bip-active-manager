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
        @page { size: letter; margin: 0.5in; }
        html, body { background: #fff; }
        .report-print-target, .report-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .no-print { display: none !important; }
          .report-print-target section { break-inside: avoid; }
          .report-print-target h1, .report-print-target h2 { break-after: avoid; }
        }
      `}</style>
      <div className="no-print mx-auto flex max-w-3xl justify-end px-8 pt-4">
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
