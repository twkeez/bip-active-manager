import { toDateString } from "./awareness-resolver";
import type { SocialSeriesWithParts } from "./types";

// Turns "drop this series on this date" into the exact list of posts it would
// create. Pure — the preview and the write both read from this, so what the
// strategist confirms is exactly what gets written.

export type ExpandedPost = {
  postDate: string;
  campaignLabel: string;
  seriesPart: number | null;
  shotList: string;
};

export type SeriesExpansion = {
  posts: ExpandedPost[];
  /** How many posts the series wanted, before clipping to the month. */
  totalWanted: number;
  /** Dropped because they fall outside the displayed month. */
  clipped: number;
};

const DAY_MS = 86_400_000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function inMonth(date: Date, year: number, month: number): boolean {
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1;
}

/**
 * Expand a series dropped on `dropDate` within the displayed month.
 *
 * recurring:
 *   weekly   — every matching day_of_week in the month
 *   biweekly — every other matching day, starting at the first occurrence
 *              on or after the drop date
 *   monthly  — a single post on the drop date
 * arc:
 *   one post per part in part_number order, starting on the drop date and
 *   spaced by spacing_days.
 *
 * Anything landing outside the month is clipped, never created.
 */
export function expandSeries(
  series: SocialSeriesWithParts,
  dropDate: string,
  year: number,
  month: number,
): SeriesExpansion {
  const drop = new Date(`${dropDate}T00:00:00Z`);
  if (Number.isNaN(drop.getTime())) return { posts: [], totalWanted: 0, clipped: 0 };

  if (series.kind === "arc") {
    const spacing = series.spacing_days ?? 1;
    const ordered = [...series.parts].sort((a, b) => a.part_number - b.part_number);
    const posts: ExpandedPost[] = [];
    let clipped = 0;

    ordered.forEach((part, i) => {
      const date = new Date(drop.getTime() + i * spacing * DAY_MS);
      if (!inMonth(date, year, month)) {
        clipped += 1;
        return;
      }
      posts.push({
        postDate: toDateString(date),
        campaignLabel: `${series.title}: ${part.title}`,
        seriesPart: part.part_number,
        shotList: part.suggested_shot ?? "",
      });
    });

    return { posts, totalWanted: ordered.length, clipped };
  }

  // recurring
  if (series.cadence === "monthly") {
    const ok = inMonth(drop, year, month);
    return {
      posts: ok
        ? [{ postDate: dropDate, campaignLabel: series.title, seriesPart: null, shotList: "" }]
        : [],
      totalWanted: 1,
      clipped: ok ? 0 : 1,
    };
  }

  const weekday = series.day_of_week;
  const total = daysInMonth(year, month);

  // Every matching weekday in the month, in date order.
  const matching: Date[] = [];
  for (let day = 1; day <= total; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    // With no day_of_week set, fall back to the weekday the drop landed on.
    const target = weekday ?? drop.getUTCDay();
    if (d.getUTCDay() === target) matching.push(d);
  }

  if (series.cadence === "biweekly") {
    // Start at the first occurrence on or after the drop date, then every other.
    const startIndex = matching.findIndex((d) => d.getTime() >= drop.getTime());
    const from = startIndex === -1 ? matching.length : startIndex;
    const picked = matching.filter((_, i) => i >= from && (i - from) % 2 === 0);
    return {
      posts: picked.map((d) => ({
        postDate: toDateString(d),
        campaignLabel: series.title,
        seriesPart: null,
        shotList: "",
      })),
      totalWanted: picked.length,
      clipped: 0,
    };
  }

  // weekly
  return {
    posts: matching.map((d) => ({
      postDate: toDateString(d),
      campaignLabel: series.title,
      seriesPart: null,
      shotList: "",
    })),
    totalWanted: matching.length,
    clipped: 0,
  };
}
