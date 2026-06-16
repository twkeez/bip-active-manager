"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Plus, Printer, RotateCcw, X } from "lucide-react";
import AuditReportExport from "@/components/site-audit/audit-report-export";
import OutputPrintStyles from "@/components/vet-onboarding/output-print-styles";
import { copyDocumentToClipboard } from "@/lib/site-audit/copy-audit-html";
import {
  appendBlock,
  buildDocumentDraft,
  createEmptyBlock,
  documentDraftFilename,
  loadDocumentDraft,
  moveBlock,
  removeBlock,
  saveDocumentDraft,
  type SiteAuditDocumentDraft,
} from "@/lib/site-audit/document-draft";
import { buildSiteAuditExportModel } from "@/lib/site-audit/export-model";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";

type Props = {
  run: WebsiteAuditRun;
  onClose: () => void;
};

const ADD_BLOCK_OPTIONS = [
  { label: "Heading", kind: "heading" as const },
  { label: "Paragraph", kind: "paragraph" as const },
  { label: "Bullet list", kind: "bullets" as const },
  { label: "Metric", kind: "metric" as const },
  { label: "Meta line", kind: "meta" as const },
];

export default function AuditExportDialog({ run, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const baseModel = useMemo(() => buildSiteAuditExportModel(run), [run]);
  const [draft, setDraft] = useState<SiteAuditDocumentDraft>(() =>
    buildDocumentDraft(baseModel),
  );

  useEffect(() => {
    const saved = loadDocumentDraft(run.id, baseModel);
    setDraft(saved ?? buildDocumentDraft(baseModel));
  }, [run.id, baseModel]);

  const suggestedFilename = documentDraftFilename(draft, baseModel);

  function handleDraftChange(next: SiteAuditDocumentDraft) {
    setDraft(next);
    saveDocumentDraft(run.id, next);
  }

  function handleReset() {
    const fresh = buildDocumentDraft(baseModel);
    setDraft(fresh);
    saveDocumentDraft(run.id, fresh);
  }

  function handleAddBlock(kind: (typeof ADD_BLOCK_OPTIONS)[number]["kind"]) {
    handleDraftChange(appendBlock(draft, createEmptyBlock(kind)));
  }

  async function handleCopy() {
    await copyDocumentToClipboard(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    document.title = suggestedFilename.replace(/\.pdf$/i, "");
    window.print();
  }

  return (
    <div className="audit-export-overlay fixed inset-0 z-50 flex flex-col bg-black/70">
      <OutputPrintStyles />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .audit-export-overlay {
                position: static !important;
                inset: auto !important;
                background: #ffffff !important;
              }
              .audit-export-block-hidden {
                display: none !important;
              }
              .audit-export-edit textarea {
                border: 0 !important;
                box-shadow: none !important;
                resize: none !important;
                overflow: visible !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
              }
            }
          `,
        }}
      />
      <div className="vet-output-no-print flex shrink-0 flex-col gap-3 border-b border-white/[0.08] bg-bip-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Export site audit</p>
            <p className="text-xs text-white/50">
              Edit headings, text, and metrics in place — hide or remove anything you do not want in
              the PDF
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-bip-page px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-bip-page px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              <ClipboardCopy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy for Google Docs"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-bip-page hover:brightness-110"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/50">Add block:</span>
          {ADD_BLOCK_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => handleAddBlock(option.kind)}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] px-2.5 py-1 text-xs text-white/75 hover:bg-white/[0.06]"
            >
              <Plus className="h-3 w-3" />
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="vet-output-shell min-h-0 flex-1 overflow-y-auto px-4 py-6 print:overflow-visible print:p-0">
        <div className="mx-auto max-w-4xl">
          <AuditReportExport
            draft={draft}
            onDraftChange={handleDraftChange}
            onRemoveBlock={(id) => handleDraftChange(removeBlock(draft, id))}
            onMoveBlock={(id, direction) => handleDraftChange(moveBlock(draft, id, direction))}
          />
        </div>
      </div>
    </div>
  );
}
