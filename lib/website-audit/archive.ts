import type { CrawlPage } from "@/lib/website-audit/types";

// WordPress's automatic listing pages: tag, category, author, month/year
// archives, "page 2" of a listing, and feeds. They repeat posts that have their
// own pages, so they don't belong in a sitemap and aren't "missing" from one.
// Shared with the browser (no server imports here).

const ARCHIVE_PATTERNS: [RegExp, NonNullable<CrawlPage["archiveType"]>][] = [
  [/\/tag\//i, "tag"],
  [/\/category\//i, "category"],
  [/\/author\//i, "author"],
];

export function archiveTypeOf(url: string): CrawlPage["archiveType"] {
  const path = pathOf(url);
  for (const [pattern, type] of ARCHIVE_PATTERNS) if (pattern.test(path)) return type;
  return null;
}

/** Any automatic listing page: the archives above, date archives (/2025/11/), paged listings (/page/2/) and feeds. */
export function isListingPage(url: string): boolean {
  const path = pathOf(url);
  return archiveTypeOf(url) != null || /\/\d{4}(\/\d{2}){0,2}\/?$/.test(path) || /\/page\/\d+\/?$/.test(path) || /\/(feed|rss)\/?$/i.test(path);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
