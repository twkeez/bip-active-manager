import * as cheerio from "cheerio";
import { extractSchemaTypes } from "@/lib/seo/schema";
import type { CrawlPage, CrawlSummary, RedirectHop, SitemapGap, SlashVariantCheck, SoftError, TechnicalCrawl } from "@/lib/website-audit/types";

// Section 3 of the Website, SEO & AI Search Audit: one polite pass over every
// URL the site's sitemaps list, on both the bare and www host. Unlike the
// older crawlers (lib/seo/crawl.ts, the site-audit crawl stage) it follows
// redirects one hop at a time so the full chain and loops are visible, and it
// reads each URL once.

const USER_AGENT = "BeyondIndigoAuditBot/1.0 (+https://beyondindigopets.com)";
const TIMEOUT_MS = 15_000;
const MAX_HOPS = 10;
const CONCURRENCY = 3;
/** Pause between requests from each worker: polite to small practice sites. */
const DELAY_MS = 300;
const MAX_URLS = 500;
const MAX_CHILD_SITEMAPS = 50;
/** Visible text kept per page for the content pass (Section 4). */
const MAX_TEXT_CHARS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Linked-but-not-in-sitemap pages checked per crawl. */
const MAX_SITEMAP_GAPS = 60;

/** A page's identity ignoring protocol, www and the trailing slash. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
    return `${bareDomain(u.host)}${path.toLowerCase()}${u.search}`;
  } catch {
    return url;
  }
}

export function bareDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

async function fetchOnce(url: string, method: "GET" | "HEAD" = "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Follows redirects one hop at a time. The last hop is the final response. */
export async function fetchWithChain(url: string): Promise<{
  chain: RedirectHop[];
  loop: boolean;
  response: Response | null;
  error: string | null;
}> {
  const chain: RedirectHop[] = [];
  const seen = new Set<string>();
  let current = url;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    if (seen.has(current)) return { chain, loop: true, response: null, error: "Redirect loop" };
    seen.add(current);
    let response: Response;
    try {
      response = await fetchOnce(current);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Timed out" : String(error instanceof Error ? error.message : error);
      chain.push({ url: current, status: 0 });
      return { chain, loop: false, response: null, error: message };
    }
    chain.push({ url: current, status: response.status });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => undefined);
      current = new URL(location, current).toString();
      continue;
    }
    return { chain, loop: false, response, error: null };
  }
  return { chain, loop: true, response: null, error: `More than ${MAX_HOPS} redirects` };
}

async function fetchText(url: string): Promise<{ status: number; text: string; finalUrl: string } | null> {
  const result = await fetchWithChain(url);
  if (!result.response) return null;
  const text = result.response.ok ? await result.response.text() : "";
  if (!result.response.ok) await result.response.body?.cancel().catch(() => undefined);
  return { status: result.response.status, text, finalUrl: result.chain.at(-1)?.url ?? url };
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
}

type SitemapScan = {
  sitemapsRead: string[];
  sitemapErrors: string[];
  urls: { url: string; sitemap: string }[];
};

/** Every page URL the site's sitemaps list (indexes followed), from robots.txt hints and the usual paths on both hosts. */
async function scanSitemaps(hosts: string[], robotsSitemaps: string[]): Promise<SitemapScan> {
  const queue = [
    ...robotsSitemaps,
    ...hosts.flatMap((host) => [`https://${host}/sitemap.xml`, `https://${host}/sitemap_index.xml`, `https://${host}/wp-sitemap.xml`]),
  ];
  const scan: SitemapScan = { sitemapsRead: [], sitemapErrors: [], urls: [] };
  const visited = new Set<string>();
  const seenUrls = new Set<string>();
  // Several entry points usually redirect to the same index: count each final sitemap once.
  const finalSeen = new Set<string>();
  while (queue.length && visited.size < MAX_CHILD_SITEMAPS) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    const fetched = await fetchText(sitemapUrl).catch(() => null);
    await sleep(DELAY_MS);
    if (!fetched || fetched.status !== 200 || !/<(urlset|sitemapindex)/i.test(fetched.text)) {
      continue;
    }
    if (finalSeen.has(fetched.finalUrl)) continue;
    finalSeen.add(fetched.finalUrl);
    scan.sitemapsRead.push(fetched.finalUrl);
    if (/<sitemapindex/i.test(fetched.text)) {
      for (const child of locs(fetched.text)) if (!visited.has(child)) queue.push(child);
      continue;
    }
    for (const url of locs(fetched.text)) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      scan.urls.push({ url, sitemap: fetched.finalUrl });
    }
  }
  if (scan.sitemapsRead.length === 0) scan.sitemapErrors.push("No readable sitemap found on either host.");
  return scan;
}

/**
 * A page that answers 200 OK but is really an error. dhah.org (2026-10-27)
 * answers every blog post without its trailing slash with a 200 whose body is
 * "SELF-REDIRECT LOOP DETECTED" and a WordPress backtrace: a status-only check
 * calls that a working page.
 */
export function softErrorOf(body: string): SoftError | null {
  const head = body.slice(0, 4000);
  if (/redirect loop detected/i.test(head)) return "redirect-loop";
  if (/Backtrace:|(Fatal|Parse) error:|Uncaught (Exception|Error)|wp-includes\/[\w-]+\.php|There has been a critical error on this website/i.test(head)) {
    return "server-error";
  }
  return null;
}

const ARCHIVE_PATTERNS: [RegExp, CrawlPage["archiveType"]][] = [
  [/\/tag\//i, "tag"],
  [/\/category\//i, "category"],
  [/\/author\//i, "author"],
];

function archiveTypeOf(url: string): CrawlPage["archiveType"] {
  for (const [pattern, type] of ARCHIVE_PATTERNS) if (pattern.test(new URL(url).pathname)) return type;
  return null;
}

/** Same URL apart from a trailing slash, letter case of the host, or default port. */
function sameUrl(a: string, b: string, ignoreTrailingSlash: boolean): boolean {
  try {
    const norm = (value: string) => {
      const u = new URL(value);
      let path = u.pathname;
      if (ignoreTrailingSlash && path.length > 1) path = path.replace(/\/+$/, "");
      return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
    };
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

export function analyzeHtml(html: string, finalUrl: string): Omit<CrawlPage, "url" | "host" | "sitemap" | "chain" | "redirectLoop" | "finalUrl" | "finalStatus" | "error" | "archiveType" | "softError"> {
  const $ = cheerio.load(html);
  const title = $("head > title").first().text().replace(/\s+/g, " ").trim() || null;
  const metaDescription = $('meta[name="description" i]').attr("content")?.replace(/\s+/g, " ").trim() || null;
  const h1s = $("h1")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get();
  const canonicalHref = $('link[rel="canonical" i]').attr("href")?.trim() || null;
  const canonical = canonicalHref ? new URL(canonicalHref, finalUrl).toString() : null;
  const hreflang = $('link[rel="alternate" i][hreflang]')
    .map((_, el) => $(el).attr("hreflang") ?? "")
    .get()
    .filter(Boolean);
  const robotsMeta = $('meta[name="robots" i]').attr("content")?.trim() || null;
  const hasViewport = $('meta[name="viewport" i]').length > 0;
  const schemaTypes = extractSchemaTypes(html);

  const body = $("body").clone();
  body.find("script, style, noscript, svg, template, iframe").remove();
  const text = body.text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  const siteHost = bareDomain(new URL(finalUrl).host);
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href") ?? "", finalUrl);
      if (!/^https?:$/.test(u.protocol) || bareDomain(u.host) !== siteHost) return;
      u.hash = "";
      if (u.search) return; // ?p=1, ?replytocom=: not pages of their own
      if (/\.(jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|zip|mp4|mp3|css|js|xml)$/i.test(u.pathname)) return;
      if (/\/(feed|wp-json|wp-admin|wp-content|wp-includes)(\/|$)|\/page\/\d+\/?$/i.test(u.pathname)) return;
      links.add(u.toString());
    } catch {
      // Not a usable URL (mailto:, javascript:, malformed): skip it.
    }
  });
  const navLinks = $("nav a[href], header a[href]")
    .map((_, el) => ({ text: $(el).text().replace(/\s+/g, " ").trim(), href: $(el).attr("href") ?? "" }))
    .get()
    .filter((link) => link.text);

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1s,
    h2Count: $("h2").length,
    wordCount,
    canonical,
    canonicalMatches: canonical ? sameUrl(canonical, finalUrl, false) : null,
    canonicalMatchesIgnoringSlash: canonical ? sameUrl(canonical, finalUrl, true) : null,
    schemaTypes,
    hreflang,
    robotsMeta,
    https: finalUrl.startsWith("https://"),
    hasViewport,
    text: text.slice(0, MAX_TEXT_CHARS),
    navLinks: navLinks.slice(0, 80),
    links: [...links].slice(0, 200),
  };
}

async function crawlUrl(entry: { url: string; sitemap: string }): Promise<CrawlPage> {
  const host = new URL(entry.url).host.toLowerCase();
  const base = { url: entry.url, host, sitemap: entry.sitemap, archiveType: archiveTypeOf(entry.url) };
  const result = await fetchWithChain(entry.url);
  const finalUrl = result.chain.at(-1)?.url ?? entry.url;
  const finalStatus = result.response?.status ?? (result.loop ? null : 0);
  const empty = {
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    h1s: [],
    h2Count: 0,
    wordCount: 0,
    canonical: null,
    canonicalMatches: null,
    canonicalMatchesIgnoringSlash: null,
    schemaTypes: [],
    hreflang: [],
    robotsMeta: null,
    https: finalUrl.startsWith("https://"),
    hasViewport: false,
    text: "",
    navLinks: [],
    links: [],
    softError: null,
  };
  if (!result.response) {
    return { ...base, ...empty, chain: result.chain, redirectLoop: result.loop, finalUrl, finalStatus, error: result.error };
  }
  const type = result.response.headers.get("content-type") ?? "";
  if (result.response.status !== 200 || !type.includes("html")) {
    await result.response.body?.cancel().catch(() => undefined);
    return { ...base, ...empty, chain: result.chain, redirectLoop: false, finalUrl, finalStatus, error: null };
  }
  const html = await result.response.text();
  const softError = softErrorOf(html);
  if (softError) return { ...base, ...empty, softError, chain: result.chain, redirectLoop: false, finalUrl, finalStatus, error: null };
  return { ...base, ...analyzeHtml(html, finalUrl), softError: null, chain: result.chain, redirectLoop: false, finalUrl, finalStatus, error: null };
}

async function exists(url: string): Promise<{ present: boolean; status: number | null; body: string }> {
  const fetched = await fetchText(url).catch(() => null);
  await sleep(DELAY_MS);
  return { present: fetched?.status === 200 && fetched.text.trim().length > 0, status: fetched?.status ?? null, body: fetched?.text ?? "" };
}

const insecureHop = (chain: RedirectHop[]) =>
  chain.some((hop, i) => i > 0 && hop.url.startsWith("http://") && chain[i - 1].url.startsWith("https://"));

/** One page per final address: the bare and www copies of a page are the same page. */
function uniqueByFinalUrl(pages: CrawlPage[]): CrawlPage[] {
  const seen = new Map<string, CrawlPage>();
  for (const page of pages) if (!seen.has(page.finalUrl)) seen.set(page.finalUrl, page);
  return [...seen.values()];
}

export function summarize(pages: CrawlPage[], domain: string, variants: SlashVariantCheck[] = []): CrawlSummary {
  const byHost: Record<string, number> = {};
  for (const page of pages) byHost[page.host] = (byHost[page.host] ?? 0) + 1;
  const ok = uniqueByFinalUrl(pages.filter((p) => p.finalStatus === 200 && !p.softError));
  const h1Count = new Map<string, number>();
  for (const page of ok) for (const h1 of new Set(page.h1s)) h1Count.set(h1, (h1Count.get(h1) ?? 0) + 1);
  const statusCounts: Record<string, number> = {};
  for (const page of pages) {
    const key = page.redirectLoop ? "loop" : page.finalStatus == null || page.finalStatus === 0 ? "error" : String(page.finalStatus);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }
  return {
    domain,
    totalUrls: pages.length,
    byHost,
    statusCounts,
    tagPages: pages.filter((p) => p.archiveType === "tag").length,
    categoryPages: pages.filter((p) => p.archiveType === "category").length,
    authorPages: pages.filter((p) => p.archiveType === "author").length,
    redirected: pages.filter((p) => p.chain.length > 1).length,
    redirectLoops: pages.filter((p) => p.redirectLoop).map((p) => p.url),
    serverErrors: pages.filter((p) => (p.finalStatus ?? 0) >= 500).map((p) => p.url),
    softErrors: pages.filter((p) => p.softError).map((p) => p.url),
    notFound: pages.filter((p) => p.finalStatus === 404).map((p) => p.url),
    fetchErrors: pages.filter((p) => p.error && !p.redirectLoop).map((p) => `${p.url}: ${p.error}`),
    pagesOk: ok.length,
    missingCanonical: ok.filter((p) => !p.canonical).length,
    canonicalMismatch: ok.filter((p) => p.canonical && !p.canonicalMatches).length,
    withSchema: ok.filter((p) => p.schemaTypes.length > 0).length,
    schemaTypes: [...new Set(ok.flatMap((p) => p.schemaTypes))].sort(),
    noH1: ok.filter((p) => p.h1s.length === 0).length,
    multipleH1: ok.filter((p) => p.h1s.length > 1).length,
    repeatedH1OnPage: ok.filter((p) => new Set(p.h1s).size < p.h1s.length).map((p) => p.url),
    duplicateH1AcrossPages: [...h1Count.entries()].filter(([, n]) => n > 1).map(([h1, n]) => ({ h1, pages: n })),
    missingTitle: ok.filter((p) => !p.title).length,
    missingMetaDescription: ok.filter((p) => !p.metaDescription).length,
    noViewport: ok.filter((p) => !p.hasViewport).length,
    notHttps: pages.filter((p) => !p.url.startsWith("https://")).length,
    noindex: ok.filter((p) => /noindex/i.test(p.robotsMeta ?? "")).map((p) => p.url),
    helloWorldInSitemap: pages.some((p) => /hello-world/i.test(p.url)),
    thinPages: ok.filter((p) => p.wordCount < 300 && !p.archiveType).length,
    uniquePages: ok.length,
    missingCanonicalUrls: ok.filter((p) => !p.canonical).map((p) => p.finalUrl),
    insecureRedirects: pages.filter((p) => insecureHop(p.chain)).map((p) => p.url),
    slashVariants: {
      checked: variants.length,
      loops: variants.filter((v) => v.loop || v.softError === "redirect-loop").map((v) => v.variantUrl),
      broken: variants.filter((v) => v.softError === "server-error").map((v) => v.variantUrl),
      duplicates: variants.filter((v) => v.chain.length === 1 && v.finalStatus === 200 && !v.softError).map((v) => v.variantUrl),
      insecure: variants.filter((v) => insecureHop(v.chain)).map((v) => v.variantUrl),
    },
  };
}

/** Section 3: crawl every sitemap URL on both hosts. `budgetMs` keeps a partial result rather than being cut off. */
export async function crawlSite(domainInput: string, budgetMs = 240_000): Promise<TechnicalCrawl> {
  const started = Date.now();
  const domain = bareDomain(domainInput);
  const hosts = [domain, `www.${domain}`];

  const robots = await Promise.all(hosts.map((host) => exists(`https://${host}/robots.txt`)));
  const robotsSitemaps = robots.flatMap((r) =>
    [...r.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1].trim()),
  );
  const llms = await Promise.all(hosts.map((host) => exists(`https://${host}/llms.txt`)));
  const homepage = await fetchWithChain(`https://${domain}/`);
  await homepage.response?.body?.cancel().catch(() => undefined);

  const sitemaps = await scanSitemaps(hosts, [...new Set(robotsSitemaps)]);
  const entries = sitemaps.urls.slice(0, MAX_URLS);

  const pages: CrawlPage[] = new Array(entries.length);
  let next = 0;
  let stoppedBecause: TechnicalCrawl["stoppedBecause"] = "done";
  async function worker() {
    while (next < entries.length) {
      if (Date.now() - started > budgetMs) {
        stoppedBecause = "time";
        return;
      }
      const index = next;
      next += 1;
      pages[index] = await crawlUrl(entries[index]);
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const crawled = pages.filter(Boolean);
  if (sitemaps.urls.length > MAX_URLS) stoppedBecause = "limit";

  // The same page with the trailing slash flipped: catches redirect loops,
  // http downgrades and pages that answer at both addresses. Real pages only;
  // tag and category archives would double the requests for little news.
  const variantTargets = uniqueByFinalUrl(crawled.filter((p) => p.finalStatus === 200 && !p.archiveType)).map((p) => {
    const u = new URL(p.finalUrl);
    if (u.pathname === "/") return null;
    u.pathname = u.pathname.endsWith("/") ? u.pathname.replace(/\/+$/, "") : `${u.pathname}/`;
    return { pageUrl: p.finalUrl, variantUrl: u.toString() };
  }).filter((v): v is { pageUrl: string; variantUrl: string } => v !== null);
  const slashVariants: SlashVariantCheck[] = [];
  let nextVariant = 0;
  async function variantWorker() {
    while (nextVariant < variantTargets.length && Date.now() - started <= budgetMs) {
      const target = variantTargets[nextVariant];
      nextVariant += 1;
      const result = await fetchWithChain(target.variantUrl);
      // Read a 200's body: it may be an error message served as a success.
      const body = result.response?.status === 200 ? await result.response.text().catch(() => "") : "";
      if (result.response?.status !== 200) await result.response?.body?.cancel().catch(() => undefined);
      slashVariants.push({
        ...target,
        chain: result.chain,
        loop: result.loop,
        finalStatus: result.response?.status ?? null,
        softError: softErrorOf(body),
      });
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, variantWorker));

  // Pages the site links to that the sitemap leaves out: slower for Google to
  // find. Compared ignoring www and the trailing slash.
  const listed = new Set(entries.map((e) => pageKey(e.url)));
  const linkedFrom = new Map<string, Set<string>>();
  for (const page of crawled) {
    for (const link of page.links) {
      if (listed.has(pageKey(link))) continue;
      const key = pageKey(link);
      if (!linkedFrom.has(key)) linkedFrom.set(key, new Set([link]));
      linkedFrom.get(key)!.add(`from:${page.finalUrl}`);
    }
  }
  const gapTargets = [...linkedFrom.values()].slice(0, MAX_SITEMAP_GAPS);
  const notInSitemap: SitemapGap[] = [];
  let nextGap = 0;
  async function gapWorker() {
    while (nextGap < gapTargets.length && Date.now() - started <= budgetMs) {
      const values = [...gapTargets[nextGap]];
      nextGap += 1;
      const url = values[0];
      const result = await fetchWithChain(url);
      const ok = result.response?.status === 200;
      const body = ok ? await result.response!.text().catch(() => "") : "";
      if (!ok) await result.response?.body?.cancel().catch(() => undefined);
      notInSitemap.push({
        url,
        linkedFrom: values.slice(1).map((v) => v.slice(5)).slice(0, 5),
        finalStatus: result.response?.status ?? null,
        softError: softErrorOf(body),
      });
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, gapWorker));

  return {
    crawledAt: new Date().toISOString(),
    domain,
    homepageChain: homepage.chain,
    robotsTxt: Object.fromEntries(hosts.map((host, i) => [host, robots[i].present])),
    llmsTxt: Object.fromEntries(hosts.map((host, i) => [host, llms[i].present])),
    sitemapsRead: sitemaps.sitemapsRead,
    sitemapErrors: sitemaps.sitemapErrors,
    sitemapUrlCount: sitemaps.urls.length,
    stoppedBecause,
    pages: crawled,
    slashVariants,
    notInSitemap: notInSitemap.sort((a, b) => a.url.localeCompare(b.url)),
    summary: summarize(crawled, domain, slashVariants),
    ms: Date.now() - started,
  };
}
