import { rankLabel, summarize, type RankChange, type SearchSummary } from "@/lib/maps-rank/summary";
import type { MapsListing, MapsRankRunRow, MapsRankTrackerRow } from "@/lib/maps-rank/types";

// Everything the Maps ranking report says, worked out once, so the PDF page
// and the Google Doc say exactly the same thing.

export type ReportSection = {
  index: number;
  keyword: string;
  goalLabel: string;
  /** "From Rockville town center: #9. From your address: #3. Goal: top 5." */
  headline: string;
  /** "Within the top 5 at 9 of the 25 map points." */
  gridLine: string;
  goalMet: boolean;
  listings: MapsListing[];
  /** Set when the search from the town point failed, so there is no list to show. */
  townError: string | null;
};

export type MapsRankReport = {
  practice: string;
  dateLabel: string;
  goalDateLabel: string | null;
  townLabel: string;
  radiusMiles: number;
  depth: number;
  reportNumber: number;
  /** True when there is nothing earlier to compare with: this report sets the baseline, so it shows no movement. */
  isBaseline: boolean;
  /** What each of the two search places means, in a sentence each. */
  places: { town: string; address: string };
  summary: (SearchSummary & { todayLabel: string; addressLabel: string; baselineLabel: string; lastLabel: string; changeLabel: string; change: RankChange })[];
  sections: ReportSection[];
  problems: string[];
  notes: string[];
};

const dateOf = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

const moved = (change: RankChange, now: number | null, before: number | null | undefined, depth: number): string => {
  if (change == null || before === undefined) return "First report";
  if (change === "same") return "No change";
  const places = now != null && before != null ? Math.abs(now - before) : null;
  if (change === "better") return places ? `Up ${places} ${places === 1 ? "place" : "places"}` : `Now in the top ${depth}`;
  return places ? `Down ${places} ${places === 1 ? "place" : "places"}` : `Dropped out of the top ${depth}`;
};

export function buildReport(
  tracker: Pick<MapsRankTrackerRow, "practice_name" | "town_label" | "searches" | "goal_date">,
  run: Pick<MapsRankRunRow, "id" | "ran_at" | "results">,
  earlier: Pick<MapsRankRunRow, "id" | "ran_at" | "results">[],
): MapsRankReport {
  const { depth, radiusMiles, gridSize } = run.results;
  const points = gridSize * gridSize;
  const rows = summarize(tracker, run, earlier);
  const step = (radiusMiles * 2) / (gridSize - 1);
  return {
    practice: tracker.practice_name,
    dateLabel: dateOf(run.ran_at),
    goalDateLabel: tracker.goal_date ? dateOf(tracker.goal_date) : null,
    townLabel: tracker.town_label,
    radiusMiles,
    depth,
    reportNumber: earlier.filter((r) => r.id !== run.id && r.ran_at < run.ran_at).length + 1,
    isBaseline: rows.every((row) => !row.baseline),
    places: {
      town: `What Google Maps shows someone who makes the search from ${tracker.town_label}. This is the rank your goals are measured on.`,
      address: "What Google Maps shows someone who makes the same search standing at your front door.",
    },
    summary: rows.map((row) => {
      // Movement is measured against the baseline: that is what the goal is judged from.
      const change = row.baseline ? row.sinceBaseline : null;
      return {
        ...row,
        change,
        todayLabel: rankLabel(row.town, depth),
        addressLabel: rankLabel(row.address, depth),
        baselineLabel: row.baseline ? `${rankLabel(row.baseline.rank, depth)} (${shortDate(row.baseline.date)})` : "This report",
        lastLabel: row.last ? `${rankLabel(row.last.rank, depth)} (${shortDate(row.last.date)})` : "—",
        changeLabel: row.baseline ? moved(change, row.town, row.baseline.rank, depth) : "First report",
      };
    }),
    sections: run.results.searches.map((s, index) => {
      const row = rows[index];
      const read = row.pointsRead;
      return {
        index,
        keyword: s.keyword,
        goalLabel: `Top ${s.goal}`,
        headline: s.town.error
          ? `Today's rank from ${tracker.town_label} couldn't be read.`
          : `From ${tracker.town_label}: ${rankLabel(s.town.rank, depth)}. From your address: ${rankLabel(s.address.rank, depth)}. Goal: top ${s.goal}.`,
        gridLine:
          read === 0
            ? "None of the map points could be read on this run."
            : `Within the top ${s.goal} at ${row.pointsAtGoal} of the ${read} map points${read < points ? ` that could be read (${points - read} failed)` : ""}${row.pointsRanked === read ? `. You appear in the top ${depth} at every point.` : `; in the top ${depth} at ${row.pointsRanked}.`}`,
        goalMet: row.goalMet,
        listings: s.town.listings,
        townError: s.town.error,
      };
    }),
    problems: run.results.problems,
    notes: [
      rows.every((row) => !row.baseline)
        ? `This report is the baseline. Every later report runs the same searches from the same two places, and shows how far each rank has moved from these numbers.`
        : `Every report runs the same searches from the same two places, so the numbers compare from one report to the next.`,
      `Each map shows your rank when the same search is made from ${points} spots: a ${gridSize} by ${gridSize} grid reaching ${radiusMiles} miles from your address in each direction, about ${step.toFixed(1)} miles apart. The ringed circle in the middle is your address; the blue diamond is ${tracker.town_label}.`,
      `Google Maps ranks by distance from the searcher, how well a listing matches the search, and how prominent it is (reviews, links, activity). Distance is why the same business ranks differently a few miles away.`,
      `We read the first ${depth} results at each spot, so a rank further down shows as "${depth}+". Paid listings are left out. What one person sees on their own phone can differ a little with their exact location and search history.`,
    ],
  };
}
