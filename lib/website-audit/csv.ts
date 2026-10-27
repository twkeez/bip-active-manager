import type { TechnicalCrawl } from "@/lib/website-audit/types";

const cell = (value: unknown) => {
  const text = value == null ? "" : Array.isArray(value) ? value.join(" | ") : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The page-by-page crawl as a spreadsheet: one row per sitemap URL. */
export function crawlCsv(crawl: TechnicalCrawl): string {
  const header = [
    "Sitemap URL", "Host", "Final URL", "Final status", "Redirect chain", "Redirect loop", "Archive",
    "Title", "Title length", "Meta description length", "H1 count", "H1s", "H2 count", "Word count",
    "Canonical", "Canonical matches", "Schema types", "Hreflang", "Robots meta", "HTTPS", "Viewport", "Error page served as 200", "Error",
  ];
  const rows = crawl.pages.map((p) => [
    p.url, p.host, p.finalUrl, p.redirectLoop ? "loop" : p.finalStatus,
    p.chain.map((hop) => `${hop.status} ${hop.url}`).join(" → "), p.redirectLoop ? "yes" : "",
    p.archiveType ?? "", p.title, p.titleLength, p.metaDescriptionLength, p.h1s.length, p.h1s, p.h2Count,
    p.wordCount, p.canonical, p.canonical ? (p.canonicalMatches ? "yes" : "no") : "", p.schemaTypes,
    p.hreflang, p.robotsMeta, p.https ? "yes" : "no", p.hasViewport ? "yes" : "no", p.softError ?? "", p.error,
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}
