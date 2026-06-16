import * as cheerio from "cheerio";
import type { SalesExtractSnippet, SalesSiteExtract } from "@/lib/types/client";

type CrawlPage = {
  url: string;
  html: string;
};

type FetchResult = {
  finalUrl: string;
  html: string | null;
  status: number;
};

type ExtractOptions = {
  maxUrls?: number;
  timeoutMs?: number;
  includeLowValuePages?: boolean;
  crawlMode?: "all_pages" | "core_pages";
};

type CrawlSettings = {
  maxUrls: number;
  timeoutMs: number;
  includeLowValuePages: boolean;
  crawlMode: "all_pages" | "core_pages";
};

const TRUST_SIGNAL_REGEXES: RegExp[] = [
  /\b\d{1,3}\+?\s+years?\b/i,
  /\bfamily[- ]owned\b/i,
  /\blocally[- ]owned\b/i,
  /\bboard[- ]certified\b/i,
  /\bcertified\b/i,
  /\baccredited\b/i,
  /\baward(?:-winning)?\b/i,
  /\bfinancing\b/i,
  /\bguarantee(?:d)?\b/i,
  /\bemergency\b/i,
  /\b24\/7\b/i,
  /\bsame[- ]day\b/i,
];

function normalizeStartUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForDedup(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function scoreSnippet(value: string) {
  let score = 0;
  const length = value.length;
  if (length >= 45 && length <= 220) score += 4;
  if (/\b(service|care|clinic|team|trusted|experience|local|community)\b/i.test(value)) score += 2;
  if (/["“”]/.test(value)) score += 1;
  if (/\b(our|we|you)\b/i.test(value)) score += 1;
  return score;
}

function pushUniqueSnippet(store: SalesExtractSnippet[], snippet: SalesExtractSnippet, maxItems: number) {
  if (!snippet.text || !snippet.sourceUrl) return;
  const normalized = normalizeForDedup(snippet.text);
  if (!normalized) return;
  if (store.some((row) => normalizeForDedup(row.text) === normalized)) return;
  store.push(snippet);
  store.sort((a, b) => scoreSnippet(b.text) - scoreSnippet(a.text));
  if (store.length > maxItems) store.length = maxItems;
}

function pushUniqueValue(store: string[], value: string, maxItems: number) {
  const normalized = normalizeForDedup(value);
  if (!normalized) return;
  if (store.some((row) => normalizeForDedup(row) === normalized)) return;
  store.push(value);
  if (store.length > maxItems) store.length = maxItems;
}

function isLikelyServiceText(value: string) {
  if (value.length < 4 || value.length > 80) return false;
  if (/\b(home|about|contact|blog|book|login|sign in)\b/i.test(value)) return false;
  return /\b(care|service|treatment|surgery|exam|wellness|dental|grooming|boarding|rehab|consult)\b/i.test(
    value,
  );
}

function looksLikeCta(value: string) {
  return /\b(book|schedule|get started|call|contact|request|consult|appointment|quote)\b/i.test(value);
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 11) return "";
  return value.trim();
}

function isLowValuePath(value: string) {
  return /\/(privacy|terms|cookie|blog|news|post|author|feed)(\/|$)/i.test(value);
}

function normalizeCrawlLink(link: string) {
  try {
    const parsed = new URL(link);
    parsed.hash = "";
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return link;
  }
}

export function resolveSalesExtractOptions(options?: ExtractOptions): CrawlSettings {
  return {
    maxUrls: Math.max(5, Math.min(options?.maxUrls ?? 50, 120)),
    timeoutMs: Math.max(3000, Math.min(options?.timeoutMs ?? 9000, 15000)),
    includeLowValuePages: options?.includeLowValuePages ?? false,
    crawlMode: options?.crawlMode ?? "all_pages",
  };
}

function extractFromPage(
  url: string,
  html: string,
  draft: Omit<SalesSiteExtract, "scannedUrls" | "sourceUrls" | "crawlDiagnostics">,
) {
  const $ = cheerio.load(html);
  const body = $("body");

  const valuePropCandidates = [
    cleanText($("h1").first().text()),
    cleanText($("h2").first().text()),
    cleanText($("main p").first().text()),
    cleanText($("header p").first().text()),
    cleanText(body.find("p").first().text()),
  ].filter(Boolean);
  for (const text of valuePropCandidates) {
    pushUniqueSnippet(draft.valueProps, { text, sourceUrl: url }, 6);
  }

  body.find("blockquote, q, [class*='testimonial'], [id*='testimonial'], [class*='review'], [id*='review']").each(
    (_, element) => {
      const text = cleanText($(element).text());
      if (text.length < 24) return;
      pushUniqueSnippet(draft.reviews, { text: text.slice(0, 260), sourceUrl: url }, 8);
    },
  );

  body.find("h2, h3, li, a").each((_, element) => {
    const text = cleanText($(element).text());
    if (!isLikelyServiceText(text)) return;
    pushUniqueValue(draft.services, text, 12);
  });

  body.find("a, button").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || !looksLikeCta(text)) return;
    pushUniqueValue(draft.ctas, text, 12);
  });

  body.find("address, footer, [class*='contact'], [id*='contact']").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text) return;
    const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0];
    const cityStateZipMatch = text.match(/[A-Za-z.\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/);
    if (phoneMatch) pushUniqueValue(draft.contactPoints, normalizePhone(phoneMatch[0]), 8);
    if (emailMatch) pushUniqueValue(draft.contactPoints, emailMatch, 8);
    if (cityStateZipMatch) {
      pushUniqueValue(draft.contactPoints, cityStateZipMatch[0], 8);
      const serviceArea = cityStateZipMatch[0].split(",")[0]?.trim();
      if (serviceArea) pushUniqueValue(draft.serviceAreas, serviceArea, 6);
    }
  });

  const bodyText = cleanText(body.text()).slice(0, 5000);
  for (const regex of TRUST_SIGNAL_REGEXES) {
    const match = bodyText.match(regex);
    if (!match) continue;
    pushUniqueValue(draft.trustSignals, match[0], 8);
  }
}

function deriveReasonsToChoose(
  extract: Omit<SalesSiteExtract, "scannedUrls" | "sourceUrls" | "crawlDiagnostics">,
) {
  const reasons: string[] = [];
  const topValue = extract.valueProps[0]?.text;
  const topReview = extract.reviews[0]?.text;
  if (topValue) {
    reasons.push(`Lead with this customer-facing promise: "${topValue}"`);
  }
  if (topReview) {
    reasons.push(`Use social proof from site copy: "${topReview}"`);
  }
  if (extract.trustSignals.length > 0) {
    reasons.push(`Build trust section around: ${extract.trustSignals.slice(0, 3).join(", ")}`);
  }
  if (extract.services.length > 0) {
    reasons.push(`Highlight top services: ${extract.services.slice(0, 4).join(", ")}`);
  }
  if (reasons.length === 0) {
    reasons.push("Use a placeholder reason-to-choose section and request client-specific proof points.");
  }
  return reasons.slice(0, 6);
}

function collectMissingSections(
  extract: Omit<SalesSiteExtract, "scannedUrls" | "sourceUrls" | "crawlDiagnostics">,
): SalesSiteExtract["missingSections"] {
  const missing: SalesSiteExtract["missingSections"] = [];
  if (extract.valueProps.length === 0) missing.push("valueProps");
  if (extract.reviews.length === 0) missing.push("reviews");
  if (extract.services.length === 0) missing.push("services");
  if (extract.trustSignals.length === 0) missing.push("trustSignals");
  return missing;
}

async function fetchHtml(url: string, timeoutMs: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "BIPSalesLabBot/1.0 (+sales-site-content)",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const html = contentType.includes("text/html") ? await response.text() : null;
    return {
      finalUrl: response.url,
      html,
      status: response.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

function collectInternalLinks($: cheerio.CheerioAPI, currentUrl: URL, rootHost: string) {
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = cleanText($(element).attr("href"));
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const absolute = new URL(href, currentUrl);
      if (!/^https?:$/.test(absolute.protocol)) return;
      if (absolute.host !== rootHost) return;
      absolute.hash = "";
      links.add(absolute.toString());
    } catch {
      // ignore invalid urls
    }
  });
  return [...links];
}

function prioritizeLinks(links: string[]) {
  const ranked = [...links];
  ranked.sort((a, b) => {
    const score = (value: string) => {
      let total = 0;
      if (/\/(about|services|service|reviews|testimonials|why|team|contact)/i.test(value)) total += 3;
      if (/\/(blog|post|news|privacy|terms)/i.test(value)) total -= 2;
      if (value.length < 48) total += 1;
      return total;
    };
    return score(b) - score(a);
  });
  return ranked;
}

export function extractSiteContentFromPages(pages: CrawlPage[]): SalesSiteExtract {
  const sourceUrls = [...new Set(pages.map((page) => page.url))];
  const draft: Omit<SalesSiteExtract, "scannedUrls" | "sourceUrls" | "crawlDiagnostics"> = {
    valueProps: [],
    reviews: [],
    services: [],
    ctas: [],
    contactPoints: [],
    serviceAreas: [],
    trustSignals: [],
    reasonsToChoose: [],
    missingSections: [],
  };
  for (const page of pages) {
    extractFromPage(page.url, page.html, draft);
  }
  draft.reasonsToChoose = deriveReasonsToChoose(draft);
  draft.missingSections = collectMissingSections(draft);
  return {
    scannedUrls: pages.length,
    sourceUrls,
    ...draft,
    crawlDiagnostics: {
      attemptedUrls: pages.length,
      skippedUrls: 0,
      skippedByReason: {},
    },
  };
}

export async function extractSalesSiteContent(rawWebsite: string, options?: ExtractOptions): Promise<SalesSiteExtract> {
  const settings = resolveSalesExtractOptions(options);
  const start = normalizeStartUrl(rawWebsite);
  if (!start) {
    throw new Error("Website URL is required for site content extraction.");
  }
  const startUrl = new URL(start);
  const queue = [normalizeCrawlLink(startUrl.toString())];
  const visited = new Set<string>();
  const pages: CrawlPage[] = [];
  const skippedByReason: Record<string, number> = {};
  let skippedUrls = 0;

  while (queue.length > 0 && visited.size < settings.maxUrls) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    if (!settings.includeLowValuePages && isLowValuePath(next)) {
      skippedUrls += 1;
      skippedByReason.lowValuePath = (skippedByReason.lowValuePath ?? 0) + 1;
      continue;
    }
    let fetched: FetchResult;
    try {
      fetched = await fetchHtml(next, settings.timeoutMs);
    } catch {
      skippedUrls += 1;
      skippedByReason.fetchError = (skippedByReason.fetchError ?? 0) + 1;
      continue;
    }
    if (fetched.status >= 400 || !fetched.html) {
      skippedUrls += 1;
      skippedByReason.badResponse = (skippedByReason.badResponse ?? 0) + 1;
      continue;
    }
    const final = fetched.finalUrl;
    const html = fetched.html;
    pages.push({ url: final, html });

    const $ = cheerio.load(html);
    let links = prioritizeLinks(collectInternalLinks($, new URL(final), startUrl.host)).map(
      normalizeCrawlLink,
    );
    if (settings.crawlMode === "core_pages") {
      links = links.filter((link) =>
        /\/(about|services|service|reviews|testimonials|why|team|contact)/i.test(link),
      );
    }
    for (const link of links) {
      if (visited.has(link) || queue.includes(link)) continue;
      if (visited.size + queue.length >= settings.maxUrls) break;
      queue.push(link);
    }
  }

  const extract = extractSiteContentFromPages(pages);
  return {
    ...extract,
    crawlDiagnostics: {
      attemptedUrls: visited.size,
      skippedUrls,
      skippedByReason,
    },
  };
}
