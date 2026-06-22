// Renders the editable block model into a real, text-based A4 PDF (selectable,
// searchable, small file) styled to the Beyond Indigo Pets brand. This replaces
// the previous html2canvas "screenshot" export for the Doc → PDF tool.

import type { jsPDF } from "jspdf";
import type { DocBlock } from "@/lib/reporting/google-doc";
import { savePdfBlob } from "@/lib/reporting/pdf-export";

export type ReportMeta = {
  title: string;
  subtitle: string;
  preparedFor: string;
  dateLabel: string;
};

type RGB = [number, number, number];

const INDIGO: RGB = [51, 80, 162]; // #3350a2
const PURPLE: RGB = [96, 56, 148]; // #603894
const MAGENTA: RGB = [150, 37, 131]; // #962583
const INDIGO_DEEP: RGB = [35, 55, 110]; // #23376e
const INDIGO_MID: RGB = [43, 68, 136]; // #2b4488
const PINK: RGB = [206, 32, 132]; // #ce2084
const INK: RGB = [55, 65, 81]; // #374151
const MUTED: RGB = [108, 116, 136]; // #6c7488
const HAIRLINE: RGB = [224, 227, 236]; // #e0e3ec

const STATUS_RED: RGB = [200, 50, 59];
const STATUS_GREEN: RGB = [31, 138, 91];
const STATUS_AMBER: RGB = [199, 125, 16];

// A4 geometry (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 18;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 20;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const PT_TO_MM = 0.352778;

function mmLineHeight(fontPt: number, factor = 1.32): number {
  return fontPt * PT_TO_MM * factor;
}

/** Maps a leading/inline status glyph to a marker colour and cleans the text. */
function extractStatus(text: string): { color: RGB | null; text: string } {
  let color: RGB | null = null;
  if (/[✅✓🟢]/u.test(text)) color = STATUS_GREEN;
  else if (/[❌✗🚫🔴]/u.test(text)) color = STATUS_RED;
  else if (/[🟡⚠]/u.test(text)) color = STATUS_AMBER;
  return { color, text: stripNonLatin(text) };
}

/** jsPDF's standard fonts are WinAnsi — replace smart punctuation and drop
 *  anything else (emoji, etc.) so nothing renders as a tofu box. */
function stripNonLatin(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // remove emoji / symbols outside basic Latin-1
    .replace(/[^\x09\x0a\x0d\x20-\xff]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function renderReportPdf(meta: ReportMeta, blocks: DocBlock[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const headerH = drawHeader(doc, meta);
  let y = headerH + 10;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  // Ensures `needed` mm of vertical space remain; starts a new page if not.
  const ensure = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const writeLines = (
    text: string,
    opts: {
      font: "bold" | "normal";
      size: number;
      color: RGB;
      x?: number;
      width?: number;
      spaceBefore?: number;
      spaceAfter?: number;
      lineFactor?: number;
    },
  ) => {
    const x = opts.x ?? MARGIN_X;
    const width = opts.width ?? CONTENT_W;
    const lh = mmLineHeight(opts.size, opts.lineFactor);
    if (opts.spaceBefore) y += opts.spaceBefore;

    doc.setFont("helvetica", opts.font);
    doc.setFontSize(opts.size);
    setColor(opts.color);

    const lines = doc.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      ensure(lh);
      doc.text(line, x, y);
      y += lh;
    }
    if (opts.spaceAfter) y += opts.spaceAfter;
    return lines.length;
  };

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
        writeLines(stripNonLatin(block.text), {
          font: "bold", size: 15, color: INDIGO_DEEP, spaceBefore: 6, spaceAfter: 2.5,
        });
        break;
      case "h2": {
        ensure(mmLineHeight(12) + 4);
        writeLines(stripNonLatin(block.text), {
          font: "bold", size: 12, color: INDIGO_MID, spaceBefore: 5, spaceAfter: 1,
        });
        // hairline under h2
        doc.setDrawColor(HAIRLINE[0], HAIRLINE[1], HAIRLINE[2]);
        doc.setLineWidth(0.2);
        doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
        y += 2.5;
        break;
      }
      case "h3":
        writeLines(stripNonLatin(block.text), {
          font: "bold", size: 10.5, color: INDIGO, spaceBefore: 3.5, spaceAfter: 1,
        });
        break;
      case "label":
        writeLines(stripNonLatin(block.text).toUpperCase(), {
          font: "bold", size: 8, color: PINK, spaceBefore: 3.5, spaceAfter: 0.5,
        });
        break;
      case "bullet": {
        const ordered = /^\d+\.\s/.test(block.text);
        const indent = 5;
        const textX = MARGIN_X + indent;
        const textW = CONTENT_W - indent;
        const status = extractStatus(block.text);
        const lh = mmLineHeight(10);
        y += 1;
        ensure(lh);
        const lineStartY = y;
        // marker
        if (status.color) {
          doc.setFillColor(status.color[0], status.color[1], status.color[2]);
          doc.circle(MARGIN_X + 1.2, lineStartY - 1.1, 0.9, "F");
        } else if (!ordered) {
          doc.setFillColor(PINK[0], PINK[1], PINK[2]);
          doc.circle(MARGIN_X + 1.2, lineStartY - 1.1, 0.8, "F");
        }
        writeLines(status.text, {
          font: "normal", size: 10, color: INK, x: textX, width: textW, lineFactor: 1.3,
        });
        break;
      }
      default: {
        const status = extractStatus(block.text);
        const lh = mmLineHeight(10);
        if (status.color) {
          ensure(lh);
          doc.setFillColor(status.color[0], status.color[1], status.color[2]);
          doc.circle(MARGIN_X + 1.2, y - 1.1, 0.9, "F");
          writeLines(status.text, {
            font: "normal", size: 10, color: INK, x: MARGIN_X + 5, width: CONTENT_W - 5,
            spaceAfter: 1.5, lineFactor: 1.35,
          });
        } else {
          writeLines(status.text, {
            font: "normal", size: 10, color: INK, spaceAfter: 2, lineFactor: 1.4,
          });
        }
        break;
      }
    }
  }

  drawFooters(doc);

  const slug =
    (meta.title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") ||
    "document";
  await savePdfBlob(doc.output("blob"), `bip-${slug}.pdf`);
}

/** Draws the brand gradient header band on page 1; returns its height in mm. */
function drawHeader(doc: jsPDF, meta: ReportMeta): number {
  const h = 46;
  // Horizontal gradient: indigo → purple → magenta, approximated with strips.
  const stops: RGB[] = [INDIGO, PURPLE, MAGENTA];
  const strips = 120;
  const stripW = PAGE_W / strips;
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const seg = t * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(seg));
    const f = seg - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const g = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    doc.setFillColor(r, g, bl);
    doc.rect(i * stripW, 0, stripW + 0.5, h, "F");
  }

  // Logo dot + agency name
  doc.setFillColor(255, 255, 255);
  doc.circle(MARGIN_X + 3, 11, 3.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INDIGO[0], INDIGO[1], INDIGO[2]);
  doc.text("B", MARGIN_X + 3, 12.2, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("Beyond Indigo Pets", MARGIN_X + 8.5, 12.2);

  // Eyebrow + title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(210, 215, 235);
  doc.text((meta.subtitle || "Report").toUpperCase(), MARGIN_X, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(meta.title || "Untitled", CONTENT_W - 45) as string[];
  let ty = 31;
  for (const line of titleLines.slice(0, 2)) {
    doc.text(line, MARGIN_X, ty);
    ty += 7;
  }

  // Right-aligned meta
  const rx = PAGE_W - MARGIN_X;
  if (meta.preparedFor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(meta.preparedFor, rx, 24, { align: "right" });
  }
  if (meta.dateLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(225, 228, 240);
    doc.text(meta.dateLabel, rx, 29.5, { align: "right" });
  }

  return h;
}

/** Pink rule + brand line + page numbers on every page. */
function drawFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const y = PAGE_H - 12;
    doc.setDrawColor(PINK[0], PINK[1], PINK[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Beyond Indigo Pets · beyondindigo.com", MARGIN_X, y + 4);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN_X, y + 4, { align: "right" });
  }
}
