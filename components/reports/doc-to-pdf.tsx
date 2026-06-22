"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { DocBlock, DocBlockType } from "@/lib/reporting/google-doc";
import { refineBlocks } from "@/lib/reporting/block-refine";
import { renderReportPdf } from "@/lib/reporting/pdf-render";

// ── Brand palette (hex — html2canvas cannot read CSS oklch vars) ─────────────
const INDIGO = "#3350a2";
const INDIGO_DEEP = "#23376e";
const INDIGO_MID = "#2b4488";
const PURPLE = "#603894";
const MAGENTA = "#962583";
const PINK = "#ce2084";
const INK = "#374151";
const MUTED = "#6c7488";
const HAIRLINE = "#e0e3ec";

const FONT_HEADING = "'Poppins', system-ui, sans-serif";
const FONT_BODY = "'Source Sans 3', system-ui, sans-serif";

const BLOCK_TYPES: { value: DocBlockType; label: string }[] = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "label", label: "Label" },
  { value: "p", label: "Body" },
  { value: "bullet", label: "Bullet" },
];

let blockSeq = 0;
function newId() {
  return `n${Date.now()}-${blockSeq++}`;
}

function blockStyle(type: DocBlockType): React.CSSProperties {
  switch (type) {
    case "h1":
      return {
        fontFamily: FONT_HEADING,
        fontSize: 26,
        fontWeight: 700,
        lineHeight: 1.25,
        color: INDIGO_DEEP,
        margin: "28px 0 8px",
      };
    case "h2":
      return {
        fontFamily: FONT_HEADING,
        fontSize: 19,
        fontWeight: 600,
        lineHeight: 1.3,
        color: INDIGO_MID,
        margin: "22px 0 6px",
        paddingBottom: 4,
        borderBottom: `1px solid ${HAIRLINE}`,
      };
    case "h3":
      return {
        fontFamily: FONT_HEADING,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.35,
        color: INDIGO,
        margin: "16px 0 4px",
      };
    case "label":
      return {
        fontFamily: FONT_HEADING,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1.3,
        color: PINK,
        margin: "14px 0 2px",
      };
    case "bullet":
      return {
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: INK,
        margin: "3px 0",
      };
    default:
      return {
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        lineHeight: 1.7,
        color: INK,
        margin: "8px 0",
      };
  }
}

type ImportMode = "link" | "upload" | "paste";

/** Lightweight client-side text → blocks (kept local to avoid bundling cheerio). */
function pastedTextToBlocks(text: string): DocBlock[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: DocBlock[] = [];
  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push({ id: newId(), type: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: heading[2].trim() });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      out.push({ id: newId(), type: "bullet", text: bullet[1].trim() });
      continue;
    }
    out.push({ id: newId(), type: "p", text: line });
  }
  return refineBlocks(out);
}

export default function DocToPdf() {
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("link");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("Client Report");
  const [preparedFor, setPreparedFor] = useState("");
  const [dateLabel, setDateLabel] = useState(
    new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  );
  const [blocks, setBlocks] = useState<DocBlock[]>([]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function importDoc() {
    if (!url.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/reports/doc-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setTitle(data.title);
      setBlocks(data.blocks);
      setLoaded(true);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function uploadDocx(file: File) {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reports/doc-import/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setTitle(data.title);
      setBlocks(data.blocks);
      setLoaded(true);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function importPaste() {
    const blocks = pastedTextToBlocks(pasteText);
    if (blocks.length === 0) {
      setImportError("Paste some text first.");
      return;
    }
    setImportError(null);
    setTitle("Untitled document");
    setBlocks(blocks);
    setLoaded(true);
  }

  function commitBlock(id: string, text: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b)),
    );
  }

  function setBlockType(id: string, type: DocBlockType) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, type } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addBlockAfter(index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { id: newId(), type: "p", text: "" });
      return next;
    });
  }

  async function downloadPdf() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await renderReportPdf({ title, subtitle, preparedFor, dateLabel }, blocks);
    } catch (e) {
      console.error("PDF export failed:", e);
      setExportError(e instanceof Error ? e.message : "PDF generation failed.");
    } finally {
      setExporting(false);
    }
  }

  // ── Import screen ──────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bip-accent/10 text-bip-accent">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-bip-text">Doc → Branded PDF</h1>
            <p className="text-sm text-bip-muted">
              Bring in a Google Doc link, a .docx, or pasted text — edit it in the BIP brand style
              and export a PDF.
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="mb-4 inline-flex rounded-lg border border-bip-border bg-bip-card p-1 text-sm">
          {([
            { id: "link" as const, label: "Doc link", icon: Link2 },
            { id: "upload" as const, label: "Upload .docx", icon: Upload },
            { id: "paste" as const, label: "Paste text", icon: ClipboardPaste },
          ]).map((t) => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMode(t.id);
                  setImportError(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                  active ? "bg-bip-accent text-white" : "text-bip-muted hover:text-bip-text"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {mode === "link" && (
          <>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3">
                <Link2 size={16} className="text-bip-subtle" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && importDoc()}
                  placeholder="https://docs.google.com/document/d/…/edit"
                  className="w-full bg-transparent py-2.5 text-sm text-bip-text outline-none placeholder:text-bip-subtle"
                />
              </div>
              <button
                type="button"
                onClick={importDoc}
                disabled={importing || !url.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : null}
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
            <p className="mt-4 text-xs text-bip-subtle">
              Uses your connected Google account. If a doc can&apos;t be reached, share it with the
              app&apos;s service account (Viewer) — or use Upload / Paste instead.
            </p>
          </>
        )}

        {mode === "upload" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadDocx(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-bip-border bg-bip-card px-6 py-10 text-sm text-bip-muted transition hover:border-bip-accent hover:text-bip-text disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={22} className="animate-spin text-bip-accent" />
              ) : (
                <Upload size={22} className="text-bip-accent" />
              )}
              {importing ? "Reading document…" : "Click to choose a .docx file"}
            </button>
            <p className="mt-4 text-xs text-bip-subtle">
              In Google Docs: <strong>File → Download → Microsoft Word (.docx)</strong>, then upload
              it here. Headings and bullets are preserved.
            </p>
          </>
        )}

        {mode === "paste" && (
          <>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              placeholder={"Paste your text here.\n\nUse # for headings, ## for sub-headings, and - for bullets."}
              className="w-full rounded-lg border border-bip-border bg-bip-card px-3 py-2.5 text-sm text-bip-text outline-none focus:border-bip-accent placeholder:text-bip-subtle"
            />
            <button
              type="button"
              onClick={importPaste}
              disabled={!pasteText.trim()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Build document
            </button>
          </>
        )}

        {importError && (
          <p className="mt-3 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger">
            {importError}
          </p>
        )}
      </div>
    );
  }

  // ── Editor + branded preview ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Toolbar */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setBlocks([]);
              setUrl("");
              setPasteText("");
              setImportError(null);
            }}
            className="text-sm text-bip-muted hover:text-bip-text"
          >
            ← New import
          </button>
          <span className="text-xs text-bip-subtle">
            Click any text to edit. Hover a line for controls.
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {exporting ? "Generating PDF…" : "Download PDF"}
          </button>
          {exportError && <p className="text-xs text-bip-danger">{exportError}</p>}
        </div>
      </div>

      {/* Meta editors (not part of PDF chrome beyond the header band) */}
      <div className="no-print mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetaField label="Report type" value={subtitle} onChange={setSubtitle} />
        <MetaField label="Prepared for" value={preparedFor} onChange={setPreparedFor} placeholder="Client name" />
        <MetaField label="Date / period" value={dateLabel} onChange={setDateLabel} />
      </div>

      {/* ── The branded A4 page (capture target) ── */}
      <div className="overflow-hidden rounded-xl shadow-lg">
        <div ref={pageRef} style={{ background: "#ffffff", color: INK }}>
          {/* Header band */}
          <header
            style={{
              background: `linear-gradient(135deg, ${INDIGO} 0%, ${PURPLE} 55%, ${MAGENTA} 100%)`,
              padding: "32px 48px 36px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <div
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  background: "rgba(255,255,255,0.2)",
                }}
              >
                B
              </div>
              <span
                style={{
                  fontFamily: FONT_HEADING,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                Beyond Indigo Pets
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <EditableText
                  as="p"
                  value={subtitle}
                  onCommit={setSubtitle}
                  style={{
                    fontFamily: FONT_HEADING,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.6)",
                    margin: "0 0 6px",
                  }}
                />
                <EditableText
                  as="h1"
                  value={title}
                  onCommit={setTitle}
                  style={{
                    fontFamily: FONT_HEADING,
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: "#fff",
                    margin: 0,
                  }}
                />
              </div>
              <div style={{ textAlign: "right", color: "rgba(255,255,255,0.78)" }}>
                {preparedFor && (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>
                    {preparedFor}
                  </p>
                )}
                <p style={{ fontFamily: FONT_BODY, fontSize: 12, margin: 0 }}>{dateLabel}</p>
              </div>
            </div>
          </header>

          {/* Body */}
          <div style={{ padding: "32px 48px 56px" }}>
            {blocks.map((block, i) => (
              <BlockRow
                key={block.id}
                block={block}
                index={i}
                total={blocks.length}
                onCommit={commitBlock}
                onType={setBlockType}
                onMove={moveBlock}
                onRemove={removeBlock}
                onAddAfter={addBlockAfter}
              />
            ))}

            {/* Footer rule */}
            <div style={{ marginTop: 40, paddingTop: 16, borderTop: `2px solid ${PINK}` }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, margin: 0 }}>
                Beyond Indigo Pets · beyondindigo.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-bip-subtle">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text outline-none focus:border-bip-accent"
      />
    </label>
  );
}

/** A contentEditable element committed on blur to avoid cursor jumps. */
function EditableText({
  as,
  value,
  onCommit,
  style,
}: {
  as: keyof React.JSX.IntrinsicElements;
  value: string;
  onCommit: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const Tag = as as "p";
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => onCommit((e.currentTarget.textContent ?? "").trim())}
      style={{ outline: "none", ...style }}
    >
      {value}
    </Tag>
  );
}

function BlockRow({
  block,
  index,
  total,
  onCommit,
  onType,
  onMove,
  onRemove,
  onAddAfter,
}: {
  block: DocBlock;
  index: number;
  total: number;
  onCommit: (id: string, text: string) => void;
  onType: (id: string, type: DocBlockType) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAddAfter: (index: number) => void;
}) {
  const isBullet = block.type === "bullet";

  return (
    <div className="group" style={{ position: "relative", display: "flex", alignItems: "flex-start" }}>
      {/* Control rail (never printed) */}
      <div
        className="no-print opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-within:opacity-100"
        style={{
          position: "absolute",
          left: -150,
          top: 2,
          width: 142,
          display: "flex",
          gap: 4,
          justifyContent: "flex-end",
        }}
      >
        <select
          value={block.type}
          onChange={(e) => onType(block.id, e.target.value as DocBlockType)}
          className="rounded border border-bip-border bg-bip-card px-1 py-0.5 text-[11px] text-bip-text"
          title="Block type"
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <RailBtn title="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>
          <ArrowUp size={12} />
        </RailBtn>
        <RailBtn title="Move down" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
          <ArrowDown size={12} />
        </RailBtn>
        <RailBtn title="Add line below" onClick={() => onAddAfter(index)}>
          <Plus size={12} />
        </RailBtn>
        <RailBtn title="Delete line" onClick={() => onRemove(block.id)}>
          <Trash2 size={12} />
        </RailBtn>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: isBullet ? 8 : 0 }}>
        {isBullet && (
          <span
            aria-hidden
            style={{ color: PINK, fontSize: 14, lineHeight: "22px", flexShrink: 0 }}
          >
            •
          </span>
        )}
        <EditableText
          as={block.type === "h1" || block.type === "h2" || block.type === "h3" ? block.type : "p"}
          value={block.text}
          onCommit={(v) => onCommit(block.id, v)}
          style={{ ...blockStyle(block.type), flex: 1, margin: isBullet ? "3px 0" : blockStyle(block.type).margin }}
        />
      </div>
    </div>
  );
}

function RailBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-5 w-5 items-center justify-center rounded border border-bip-border bg-bip-card text-bip-muted transition hover:text-bip-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}
