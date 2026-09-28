// Keyword numbers for client reports: one 28-day period against the 28 days
// before it.
//
// Each Search Console snapshot already holds a keyword's 28-day totals, and
// since 2026-09-17 there is one per night. The report used to add up the
// newest 7 snapshots as "current" and the next 7 as "previous": seven
// overlapping 28-day windows summed, so clicks read up to 7x too high
// (Bayside: 13 real clicks shown as 87). Now "current" is the newest completed
// snapshot, and "previous" is the one covering the 28 days just before it.
// When that earlier period has not been captured, the report says so rather
// than invent a number.

export type GscSnapshotWindow = {
  id: number;
  start_date: string | null;
  end_date: string | null;
  run_status: string | null;
  created_at: string;
};

export type KeywordPeriodRow = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  period: "current" | "previous";
};

const DAY_MS = 86_400_000;
/** Nightly runs can be skipped; accept a previous window ending this close to the ideal. */
export const PREVIOUS_WINDOW_TOLERANCE_DAYS = 3;

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/** The newest completed snapshot, and the completed one covering the period just before it. */
export function pickKeywordPeriods<T extends GscSnapshotWindow>(
  snapshots: T[],
): { current: T | null; previous: T | null } {
  const completed = snapshots
    .filter((s) => s.run_status === "completed" && s.start_date && s.end_date)
    .sort((a, b) => b.end_date!.localeCompare(a.end_date!) || b.created_at.localeCompare(a.created_at));
  const current = completed[0] ?? null;
  if (!current) return { current: null, previous: null };

  const idealEnd = dayNumber(current.start_date!) - 1;
  let previous: T | null = null;
  let bestGap = Infinity;
  for (const snapshot of completed) {
    const end = dayNumber(snapshot.end_date!);
    // Must end before the current period starts, so the two never overlap.
    if (end >= dayNumber(current.start_date!)) continue;
    const gap = Math.abs(end - idealEnd);
    if (gap <= PREVIOUS_WINDOW_TOLERANCE_DAYS && gap < bestGap) {
      previous = snapshot;
      bestGap = gap;
    }
  }
  return { current, previous };
}

/** The window a missing previous snapshot should cover: the 28 days (or current length) before `current`. */
export function previousWindowFor(current: { start_date: string; end_date: string }): {
  startDate: string;
  endDate: string;
} {
  const length = dayNumber(current.end_date) - dayNumber(current.start_date);
  const end = dayNumber(current.start_date) - 1;
  const toIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
  return { startDate: toIso(end - length), endDate: toIso(end) };
}
