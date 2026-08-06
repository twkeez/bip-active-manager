import * as cheerio from "cheerio";
import { runQuickSeoCrawl } from "@/lib/seo/crawl";
import type { CrawlPageRecord, CrawlStageResult } from "@/lib/site-audit/types";
import { fetchTextWithTimeout, normalizeAuditUrl } from "@/lib/site-audit/shared";

const MAX_PAGES = 20;

function text(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripHash(url: string) {
  return url.replace(/#.*$/, "");
}

// Real-world JSON-LD is often technically-invalid JSON that lenient validators
// (schema.org, Google) still accept: leading `//` banner comments, `/* */`
// blocks, or trailing commas. Strip those before parsing so we don't report a
// false "no schema" on pages that clearly have it. Operates on the original,
// newline-preserved script text — a collapsed one-liner would let a `//`
// comment swallow the whole object.
function sanitizeJsonLd(raw: string) {
  return raw
    .replace(/^\s*\/\/.*$/gm, "") // full-line // comments (leaves // inside URLs alone)
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ block comments
    .replace(/,\s*([}\]])/g, "$1") // trailing commas before } or ]
    .trim();
}

function extractSchemaTypes(html: string) {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  const addType = (type: unknown) => {
    if (typeof type === "string" && type.trim()) types.add(type.trim());
    else if (Array.isArray(type)) type.forEach(addType);
  };
  $('script[type="application/ld+json"]').each((_, node) => {
    const raw = $(node).html();
    if (!raw || !raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizeJsonLd(raw));
    } catch {
      // still unparseable after sanitizing — genuinely broken markup
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      addType(record["@type"]);
      // Yoast/RankMath and many CMSs wrap entities in an @graph array.
      const graph = record["@graph"];
      if (Array.isArray(graph)) {
        for (const entry of graph) {
          if (entry && typeof entry === "object") {
            addType((entry as Record<string, unknown>)["@type"]);
          }
        }
      }
    }
  });
  return [...types];
}

function wordCountFromHtml(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  return text($("body").text()).split(/\s+/).filter(Boolean).length;
}

export async function runCrawlStage(startUrl: string): Promise<CrawlStageResult> {
  const normalized = normalizeAuditUrl(startUrl);
  if (!normalized) throw new Error("URL is required for crawl.");

  const crawlResult = await runQuickSeoCrawl(normalized, MAX_PAGES);

  const start = new URL(normalized);
  const rootHost = start.host;
  const queue: Array<{ url: string; depth: number }> = [
    { url: stripHash(start.toString()), depth: 0 },
  ];
  const visited = new Set<string>();
  const pages: CrawlPageRecord[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const next = queue.shift();
    if (!next || visited.has(next.url)) continue;
    visited.add(next.url);

    try {
      const { response, text: html } = await fetchTextWithTimeout(next.url);
      const title = cheerio.load(html)("title").first().text();
      pages.push({
        url: response.url,
        depth: next.depth,
        status: response.status,
        title: text(title) || null,
        wordCount: wordCountFromHtml(html),
        schemaTypes: extractSchemaTypes(html),
      });

      if (!response.ok || !html.includes("<html")) continue;
      const $ = cheerio.load(html);
      const currentUrl = new URL(response.url);
      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
          return;
        }
        try {
          const link = new URL(href, currentUrl);
          if (link.host !== rootHost) return;
          const normalizedLink = stripHash(link.toString());
          if (visited.has(normalizedLink)) return;
          if (queue.some((item) => item.url === normalizedLink)) return;
          if (pages.length + queue.length >= MAX_PAGES) return;
          queue.push({ url: normalizedLink, depth: next.depth + 1 });
        } catch {
          // skip bad href
        }
      });
    } catch {
      pages.push({
        url: next.url,
        depth: next.depth,
        status: 0,
        title: null,
        wordCount: 0,
        schemaTypes: [],
      });
    }
  }

  return {
    baseUrl: crawlResult.baseUrl,
    crawledUrls: pages.length,
    pages,
    issues: crawlResult.issues.map((issue) => ({
      rule_id: issue.rule_id,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
      url: issue.url,
    })),
  };
}
