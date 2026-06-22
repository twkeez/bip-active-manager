import type { DocBlock, DocBlockType } from "@/lib/reporting/google-doc";

// Heuristic structure detection for docs that use manual formatting (ALL-CAPS
// lines, dashes, "1.2" numbering, trailing-colon labels) instead of real
// Heading styles and bullet lists. Runs on every import path so the output
// looks structured regardless of how the source was formatted.

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase();
}

/** Reclassifies a single paragraph's text into a more specific block type. */
function classifyParagraph(text: string): { type: DocBlockType; text: string } {
  const t = text.trim();

  // Unordered bullet markers → bullet (strip the marker).
  const dash = t.match(/^[-–—•*]\s+(.*)$/);
  if (dash) return { type: "bullet", text: dash[1].trim() };

  // Ordered list item ("1. Do the thing") → bullet, keep the number as marker.
  if (/^\d+\.\s+\S/.test(t) && !/^\d+\.\d+/.test(t)) {
    return { type: "bullet", text: t };
  }

  // Section / part headers → top-level heading.
  if (/^(section|part|phase|step)\s+[\dIVXivx]+\b/i.test(t)) {
    return { type: "h1", text: t };
  }

  // Numbered subsection ("1.2 Core Web Vitals", "1.2.3 …") → heading.
  if (/^\d+\.\d+(\.\d+)?\s+\S/.test(t)) {
    return { type: "h2", text: t };
  }

  // Short ALL-CAPS line ending in a colon → eyebrow label (FINDINGS:, etc.).
  if (/^[A-Z0-9][A-Z0-9 /&'’()\-]{0,38}:$/.test(t) && isAllCaps(t)) {
    return { type: "label", text: t.replace(/:$/, "") };
  }

  // Short ALL-CAPS standalone line → heading (EXECUTIVE SUMMARY, etc.).
  if (isAllCaps(t) && t.length <= 50 && !/[.!?]$/.test(t)) {
    return { type: "h2", text: t };
  }

  return { type: "p", text: t };
}

/**
 * Refines imported blocks. Real headings/bullets (from genuine Doc styles) are
 * left untouched; only plain paragraphs are re-examined for implied structure.
 */
export function refineBlocks(blocks: DocBlock[]): DocBlock[] {
  return blocks.map((b) => {
    if (b.type !== "p") return b;
    const { type, text } = classifyParagraph(b.text);
    return { ...b, type, text };
  });
}
