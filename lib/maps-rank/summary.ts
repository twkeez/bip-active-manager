import type { MapsRankResults, MapsRankRunRow, MapsRankTrackerRow, SearchResult } from "@/lib/maps-rank/types";

export type RankChange = "better" | "worse" | "same" | null;

export type SearchSummary = {
  keyword: string;
  goal: number;
  town: number | null;
  address: number | null;
  /** Grid points read, and how many of them have the practice within its goal. */
  pointsRead: number;
  pointsAtGoal: number;
  pointsRanked: number;
  baseline: { rank: number | null; date: string } | null;
  last: { rank: number | null; date: string } | null;
  sinceBaseline: RankChange;
  sinceLast: RankChange;
  goalMet: boolean;
};

/** "#4", or "Not in the top 20". */
export const rankLabel = (rank: number | null, depth: number) => (rank == null ? `Not in the top ${depth}` : `#${rank}`);

/** A lower number is better; unranked is worse than any rank. */
export function rankChange(now: number | null, before: number | null | undefined): RankChange {
  if (before === undefined) return null;
  const a = now ?? Infinity;
  const b = before ?? Infinity;
  return a === b ? "same" : a < b ? "better" : "worse";
}

const gridCounts = (s: SearchResult) => {
  const read = s.grid.filter((p) => !p.failed);
  return { pointsRead: read.length, pointsRanked: read.filter((p) => p.rank != null).length, pointsAtGoal: read.filter((p) => p.rank != null && p.rank <= s.goal).length };
};

/**
 * One line per tracked search: today's rank from the town point and the
 * address, against the baseline (a rank recorded on the tracker, else the
 * first run) and the run before this one.
 */
export function summarize(
  tracker: Pick<MapsRankTrackerRow, "searches">,
  run: Pick<MapsRankRunRow, "id" | "ran_at" | "results">,
  earlier: Pick<MapsRankRunRow, "id" | "ran_at" | "results">[],
): SearchSummary[] {
  const before = earlier.filter((r) => r.id !== run.id && r.ran_at < run.ran_at).sort((a, b) => a.ran_at.localeCompare(b.ran_at));
  const townIn = (results: MapsRankResults, keyword: string) => {
    const s = results.searches.find((x) => x.keyword === keyword);
    return s && !s.town.error ? { rank: s.town.rank } : null;
  };
  return run.results.searches.map((s) => {
    const tracked = tracker.searches.find((t) => t.keyword === s.keyword);
    const first = before.map((r) => ({ r, t: townIn(r.results, s.keyword) })).find((x) => x.t);
    const previous = [...before].reverse().map((r) => ({ r, t: townIn(r.results, s.keyword) })).find((x) => x.t);
    const baseline = tracked?.baseline ? { rank: tracked.baseline.rank, date: tracked.baseline.date } : first ? { rank: first.t!.rank, date: first.r.ran_at } : null;
    const last = previous ? { rank: previous.t!.rank, date: previous.r.ran_at } : null;
    return {
      keyword: s.keyword,
      goal: s.goal,
      town: s.town.rank,
      address: s.address.rank,
      ...gridCounts(s),
      baseline,
      last,
      sinceBaseline: s.town.error ? null : rankChange(s.town.rank, baseline?.rank),
      sinceLast: s.town.error ? null : rankChange(s.town.rank, last?.rank),
      goalMet: s.town.rank != null && s.town.rank <= s.goal,
    };
  });
}
