import * as cheerio from "cheerio";
import { extractSchemaTypes, findSchemaGaps } from "@/lib/seo/schema";

export type CrawlSeverity = "critical" | "watch";
export type CrawlCategory = "crawl" | "onpage" | "performance" | "indexability";

export type CrawlIssue = {
  rule_id: string;
  severity: CrawlSeverity;
  category: CrawlCategory;
  title: string;
  description: string | null;
  suggestion: string | null;
  url: string | null;
  location: string | null;
  evidence: string | null;
  occurrence_key: string;
};

/**
 * What each crawled page actually says. The crawler already read all of this to
 * decide which issues to raise; keeping it means the UI can show the current
 * title and description rather than only "this one is too long".
 */
export type CrawlPageFact = {
  url: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  noindex: boolean;
  schemaTypes: string[];
};

export type CrawlResult = {
  baseUrl: string;
  crawledUrls: number;
  issues: CrawlIssue[];
  pages: CrawlPageFact[];
  /** Site-wide schema expectations this site does not meet. */
  schemaGaps: ReturnType<typeof findSchemaGaps>;
};

type CrawlPageResult = {
  url: string;
  status: number;
  html: string | null;
  contentType: string | null;
  redirected: boolean;
};

function normalizeStartUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function stripHash(url: string) {
  return url.replace(/#.*$/, "");
}

function buildOccurrenceKey(ruleId: string, parts: Array<string | null | undefined>) {
  return `${ruleId}::${parts.map((part) => (part ?? "").trim()).join("::")}`;
}

function text(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<CrawlPageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "BIPActiveManagerBot/1.0 (+seo-crawl)",
      },
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type");
    const html = contentType?.includes("text/html") ? await response.text() : null;
    return {
      url: response.url,
      status: response.status,
      html,
      contentType,
      redirected: response.redirected,
    };
  } finally {
    clearTimeout(timer);
  }
}

function collectInternalLinks($: cheerio.CheerioAPI, currentUrl: URL, rootHost: string) {
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = text($(element).attr("href"));
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const absolute = new URL(href, currentUrl);
      if (!/^https?:$/.test(absolute.protocol)) return;
      if (absolute.host !== rootHost) return;
      absolute.hash = "";
      links.add(stripHash(absolute.toString()));
    } catch {
      // Ignore invalid links.
    }
  });
  return [...links];
}

function pushIssue(
  store: Map<string, CrawlIssue>,
  issue: Omit<CrawlIssue, "occurrence_key"> & { occurrenceParts: Array<string | null | undefined> },
) {
  const occurrence_key = buildOccurrenceKey(issue.rule_id, issue.occurrenceParts);
  if (store.has(occurrence_key)) return;
  store.set(occurrence_key, {
    rule_id: issue.rule_id,
    severity: issue.severity,
    category: issue.category,
    title: issue.title,
    description: issue.description,
    suggestion: issue.suggestion,
    url: issue.url,
    location: issue.location,
    evidence: issue.evidence,
    occurrence_key,
  });
}

export async function runQuickSeoCrawl(rawWebsite: string, maxUrls = 50): Promise<CrawlResult> {
  const start = normalizeStartUrl(rawWebsite);
  if (!start) throw new Error("Website is required for crawl.");
  const startUrl = new URL(start);
  const rootHost = startUrl.host;
  const queue: string[] = [stripHash(startUrl.toString())];
  const visited = new Set<string>();
  const issues = new Map<string, CrawlIssue>();
  const pages: CrawlPageFact[] = [];
  let crawledUrls = 0;

  while (queue.length > 0 && crawledUrls < maxUrls) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);
    crawledUrls += 1;

    let page: CrawlPageResult;
    try {
      page = await fetchWithTimeout(nextUrl);
    } catch {
      pushIssue(issues, {
        rule_id: "request-failed",
        severity: "critical",
        category: "crawl",
        title: "Page request failed",
        description: "The page could not be fetched during crawl.",
        suggestion: "Verify the URL and server availability.",
        url: nextUrl,
        location: nextUrl,
        evidence: "Fetch error or timeout",
        occurrenceParts: [nextUrl],
      });
      continue;
    }

    if (page.status >= 400) {
      pushIssue(issues, {
        rule_id: "http-status",
        severity: "critical",
        category: "crawl",
        title: "Non-200 page response",
        description: "A crawled page returned an error status.",
        suggestion: "Fix the URL or server route to return a valid response.",
        url: page.url,
        location: page.url,
        evidence: `status=${page.status}`,
        occurrenceParts: [page.url, String(page.status)],
      });
    } else if (page.status >= 300 || page.redirected) {
      pushIssue(issues, {
        rule_id: "redirected-page",
        severity: "watch",
        category: "crawl",
        title: "Page responds with redirect",
        description: "A crawled URL redirected before final response.",
        suggestion: "Link directly to the final destination URL where possible.",
        url: page.url,
        location: page.url,
        evidence: `status=${page.status}`,
        occurrenceParts: [page.url, String(page.status)],
      });
    }

    if (!page.html || !page.contentType?.includes("text/html")) {
      continue;
    }

    const currentUrl = new URL(page.url);
    const $ = cheerio.load(page.html);

    const title = text($("title").first().text());
    if (!title) {
      pushIssue(issues, {
        rule_id: "missing-title",
        severity: "critical",
        category: "onpage",
        title: "Missing page title",
        description: "The page does not include a <title> element.",
        suggestion: "Add a unique, descriptive title tag.",
        url: page.url,
        location: "title",
        evidence: null,
        occurrenceParts: [page.url],
      });
    } else if (title.length > 60) {
      pushIssue(issues, {
        rule_id: "long-title",
        severity: "watch",
        category: "onpage",
        title: "Page title may be too long",
        description: "Long titles can truncate in search results.",
        suggestion: "Keep title near 50-60 characters where possible.",
        url: page.url,
        location: "title",
        evidence: `${title.length} characters`,
        occurrenceParts: [page.url, String(title.length)],
      });
    }

    const metaDescription = text($('meta[name="description"]').attr("content"));
    if (!metaDescription) {
      pushIssue(issues, {
        rule_id: "missing-meta-description",
        severity: "watch",
        category: "onpage",
        title: "Missing meta description",
        description: "The page does not include a meta description.",
        suggestion: "Add a concise description to improve search snippets.",
        url: page.url,
        location: 'meta[name="description"]',
        evidence: null,
        occurrenceParts: [page.url],
      });
    } else if (metaDescription.length > 160) {
      pushIssue(issues, {
        rule_id: "long-meta-description",
        severity: "watch",
        category: "onpage",
        title: "Meta description may be too long",
        description: "Long descriptions can truncate in search results.",
        suggestion: "Target roughly 120-160 characters.",
        url: page.url,
        location: 'meta[name="description"]',
        evidence: `${metaDescription.length} characters`,
        occurrenceParts: [page.url, String(metaDescription.length)],
      });
    }

    const canonical = text($('link[rel="canonical"]').attr("href"));
    if (!canonical) {
      pushIssue(issues, {
        rule_id: "missing-canonical",
        severity: "watch",
        category: "indexability",
        title: "Missing canonical link",
        description: "Canonical URL is not declared for this page.",
        suggestion: "Add a canonical tag pointing to the preferred URL.",
        url: page.url,
        location: 'link[rel="canonical"]',
        evidence: null,
        occurrenceParts: [page.url],
      });
    }

    const h1Count = $("h1").length;
    if (h1Count === 0) {
      pushIssue(issues, {
        rule_id: "missing-h1",
        severity: "watch",
        category: "onpage",
        title: "Missing H1 heading",
        description: "No H1 heading detected on page.",
        suggestion: "Add a single clear H1 heading describing the page topic.",
        url: page.url,
        location: "h1",
        evidence: null,
        occurrenceParts: [page.url],
      });
    } else if (h1Count > 1) {
      pushIssue(issues, {
        rule_id: "multiple-h1",
        severity: "watch",
        category: "onpage",
        title: "Multiple H1 headings",
        description: "Multiple H1 tags can dilute content hierarchy.",
        suggestion: "Use one primary H1 and demote additional headings to H2/H3.",
        url: page.url,
        location: "h1",
        evidence: `${h1Count} h1 tags`,
        occurrenceParts: [page.url, String(h1Count)],
      });
    }

    $("img").each((_, img) => {
      const alt = text($(img).attr("alt"));
      const src = text($(img).attr("src"));
      if (alt) return;
      pushIssue(issues, {
        rule_id: "missing-image-alt",
        severity: "watch",
        category: "onpage",
        title: "Image missing alt text",
        description: "Image does not have alt text.",
        suggestion: "Add meaningful alt text to informative images.",
        url: page.url,
        location: src || "img",
        evidence: src || null,
        occurrenceParts: [page.url, src || "img"],
      });
    });

    const robotsContent = text($('meta[name="robots"]').attr("content")).toLowerCase();
    if (robotsContent.includes("noindex")) {
      pushIssue(issues, {
        rule_id: "noindex-present",
        severity: "critical",
        category: "indexability",
        title: "Page marked noindex",
        description: "Meta robots contains noindex directive.",
        suggestion: "Remove noindex if this page should appear in search.",
        url: page.url,
        location: 'meta[name="robots"]',
        evidence: robotsContent,
        occurrenceParts: [page.url, robotsContent],
      });
    }

    // Everything above has already been parsed to raise issues; keep the values
    // themselves so the UI can show what the page actually says.
    pages.push({
      url: page.url,
      status: page.status,
      title: title || null,
      metaDescription: metaDescription || null,
      canonical: canonical || null,
      noindex: robotsContent.includes("noindex"),
      schemaTypes: extractSchemaTypes(page.html),
    });

    const links = collectInternalLinks($, currentUrl, rootHost);
    for (const link of links) {
      if (visited.has(link)) continue;
      if (queue.includes(link)) continue;
      if (visited.size + queue.length >= maxUrls) break;
      queue.push(link);
    }
  }

  // Schema expectations are site-wide, not per page: a practice needs
  // VeterinaryCare markup *somewhere*, not on every URL.
  const schemaTypesAcrossSite = [...new Set(pages.flatMap((p) => p.schemaTypes))];

  return {
    baseUrl: startUrl.toString(),
    crawledUrls,
    issues: [...issues.values()],
    pages,
    schemaGaps: findSchemaGaps(schemaTypesAcrossSite),
  };
}
