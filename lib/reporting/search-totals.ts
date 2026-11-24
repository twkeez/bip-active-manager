// Search Console numbers for the client report.
//
// The report used to add up its top 10 listed pages and call that "Total
// clicks", and to average those pages' positions without weighting them, so the
// Search Traffic section disagreed with the Performance Overview on the same
// page (Adobe Animal Hospital, Nov 24 2026: 50 clicks against 56). Whole-site
// totals now come from Search Console's day-by-day numbers for the property,
// which are what Google's own Performance report shows. Page rows are only used
// for the page lists, merged so a page reached through a tracking link
// (?rwg_token=…, ?utm_…) counts as the page itself.

export type SearchRow = {
  clicks: number;
  impressions: number;
  position: number;
};

export type SearchTotals = {
  clicks: number;
  impressions: number;
  /** Clicks ÷ impressions, as a percentage. Null with no impressions. */
  ctrPercent: number | null;
  /** Average position weighted by impressions. Null with no impressions. */
  position: number | null;
};

/** The page address without its query string or #fragment. */
export function pageWithoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * One row per page address once query strings are dropped. Clicks and
 * impressions add up; position is weighted by impressions, as Search Console
 * weights it.
 */
export function mergePagesByAddress<T extends SearchRow & { page_url: string }>(rows: T[]): T[] {
  const byPage = new Map<string, { row: T; weightedPosition: number }>();
  for (const row of rows) {
    const key = pageWithoutQuery(row.page_url);
    const existing = byPage.get(key);
    if (!existing) {
      byPage.set(key, {
        row: { ...row, page_url: key },
        weightedPosition: row.position * row.impressions,
      });
      continue;
    }
    existing.row = {
      ...existing.row,
      clicks: existing.row.clicks + row.clicks,
      impressions: existing.row.impressions + row.impressions,
    };
    existing.weightedPosition += row.position * row.impressions;
  }
  return [...byPage.values()].map(({ row, weightedPosition }) => {
    const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
    const position = row.impressions > 0 ? weightedPosition / row.impressions : row.position;
    return { ...row, ctr, position };
  });
}

/** Totals over a set of rows: summed clicks and impressions, impression-weighted position. */
export function sumSearchRows(rows: SearchRow[]): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctrPercent: impressions > 0 ? (clicks / impressions) * 100 : null,
    position: impressions > 0 ? weightedPosition / impressions : null,
  };
}

/**
 * A readable title for a blog address: the last part of the path, with dashes
 * as spaces. The blog's own home page has no post name, so it says so instead
 * of showing a blank line.
 */
export function blogPostTitle(url: string): string {
  const path = pageWithoutQuery(url).replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "");
  const slug = path.replace(/^.*\/blog\/?/, "").split("/").filter(Boolean).pop() ?? "";
  const words = slug.replace(/\.[a-z0-9]+$/i, "").split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return "Blog home page";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
