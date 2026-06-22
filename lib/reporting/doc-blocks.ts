import * as cheerio from "cheerio";
import type { DocBlock, DocBlockType } from "@/lib/reporting/google-doc";

let seq = 0;
function nextId() {
  return `i${seq++}`;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const HEADING_TAGS: Record<string, DocBlockType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h3",
  h5: "h3",
  h6: "h3",
};

/**
 * Converts an HTML fragment (e.g. mammoth's DOCX output) into editable blocks.
 * Headings map to h1–h3, list items to bullets, everything else to paragraphs.
 */
export function htmlToBlocks(html: string): DocBlock[] {
  const $ = cheerio.load(html);
  const blocks: DocBlock[] = [];

  $("body")
    .find("h1, h2, h3, h4, h5, h6, p, li")
    .each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "p";
      const text = clean($(el).text());
      if (!text) return;

      let type: DocBlockType;
      if (tag === "li") type = "bullet";
      else type = HEADING_TAGS[tag] ?? "p";

      blocks.push({ id: nextId(), type, text });
    });

  return blocks;
}

/**
 * Converts pasted plain text into editable blocks. Blank lines separate
 * paragraphs; lines beginning with -, *, • become bullets; lines beginning
 * with markdown # become headings.
 */
export function textToBlocks(text: string): DocBlock[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: DocBlock[] = [];

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const type: DocBlockType = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push({ id: nextId(), type, text: clean(heading[2]) });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ id: nextId(), type: "bullet", text: clean(bullet[1]) });
      continue;
    }

    blocks.push({ id: nextId(), type: "p", text: clean(line) });
  }

  return blocks;
}
