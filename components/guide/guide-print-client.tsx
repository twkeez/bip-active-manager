"use client";
import { useEffect } from "react";
import GuideDocument from "@/components/guide/guide-document";
import { GUIDE } from "@/lib/guide/content";

export default function GuidePrintClient() {
  useEffect(() => {
    document.title = "BIP Control team guide · Beyond Indigo Pets";
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        /* No page margin, so Chrome and Edge have nowhere to stamp their own
           header and footer; the document carries the margin itself, repeated
           on every printed page (as on the client document). */
        @page { size: letter; margin: 0; }
        html, body { background: #fff; }
        .guide-print-target, .guide-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .guide-print-target {
            box-sizing: border-box;
            padding: calc(0.5in + 1rem) !important;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
          }
          .no-print { display: none !important; }
          .guide-print-target section { border: none !important; padding-left: 0 !important; padding-right: 0 !important; }
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
      <div className="guide-print-target bg-white px-8 py-8">
        <GuideDocument guide={GUIDE} linksAsText />
      </div>
    </>
  );
}
