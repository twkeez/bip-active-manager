import * as cheerio from "cheerio";
import { collectSitemapEntries } from "@/lib/site-audit/sitemap";
import {
  FETCH_CONCURRENCY,
  FETCH_USER_AGENT,
  MAX_FULL_TEXT_PAGES,
  MAX_PAGE_TEXT_CHARS,
  MAX_SITEMAP_URLS,
} from "@/lib/llms-txt/constants";
import type { PageSnapshot } from "@/lib/llms-txt/types";
import { normalizeWebsite, sitemapUrlForWebsite } from "@/lib/llms-txt/website";

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractPageContent(html: string, url: string): Pick<PageSnapshot, "title" | "description" | "text"> {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  $("nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo']").remove();

  const title = collapseWhitespace($("title").first().text()) || url;
  const description =
    collapseWhitespace($('meta[name="description"]').attr("content") ?? "") ||
    collapseWhitespace($('meta[property="og:description"]').attr("content") ?? "");

  const main =
    $("main").first().text() ||
    $("article").first().text() ||
    $("[role='main']").first().text() ||
    $("body").text();

  let text = collapseWhitespace(main);
  if (text.length > MAX_PAGE_TEXT_CHARS) {
    text = `${text.slice(0, MAX_PAGE_TEXT_CHARS)}…`;
  }

  return { title, description, text };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent": FETCH_USER_AGENT,
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  return response.text();
}

export async function discoverSiteUrls(website: string): Promise<string[]> {
  const base = normalizeWebsite(website);
  const sitemapUrl = sitemapUrlForWebsite(base);

  try {
    const entries = await collectSitemapEntries(sitemapUrl, MAX_SITEMAP_URLS);
    if (entries.length > 0) {
      return entries.map((e) => e.loc);
    }
  } catch {
    // fall through to homepage crawl
  }

  try {
    const html = await fetchHtml(base);
    const $ = cheerio.load(html);
    const origin = new URL(base).origin;
    const links = new Set<string>([base]);

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") ?? "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const absolute = new URL(href, base).href.split("#")[0]!;
        if (new URL(absolute).origin === origin) {
          links.add(absolute);
        }
      } catch {
        // ignore bad URLs
      }
    });

    return [...links].slice(0, MAX_SITEMAP_URLS);
  } catch {
    return [base];
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function fetchPageSnapshots(
  urls: string[],
  limit = MAX_FULL_TEXT_PAGES,
): Promise<PageSnapshot[]> {
  const unique = [...new Set(urls)].slice(0, limit);
  return mapWithConcurrency(unique, FETCH_CONCURRENCY, async (url) => {
    try {
      const html = await fetchHtml(url);
      const extracted = extractPageContent(html, url);
      return { url, ...extracted };
    } catch (error) {
      return {
        url,
        title: url,
        description: "",
        text: "",
        fetchError: error instanceof Error ? error.message : "Fetch failed",
      };
    }
  });
}

export function buildCurationInput(pages: PageSnapshot[]): string {
  return pages
    .map((p) => {
      const snippet = (p.description || p.text).slice(0, 280);
      return `- ${p.url}\n  title: ${p.title}\n  snippet: ${snippet}${p.fetchError ? `\n  error: ${p.fetchError}` : ""}`;
    })
    .join("\n");
}
