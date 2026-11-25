import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import { isDismissed, shapeAndSort, waitTone, type ShapedReportRow } from "@/lib/basecamp/response-report";
import type { MonthlyListRow } from "@/lib/reporting/monthly-list";
import { countStates, type StateCounts } from "@/lib/reporting/monthly";
import {
  NO_STRATEGIST_ON_SHEET,
  countByStrategist,
  groupByStrategist,
  toWatchRow,
  type StrategistCounts,
  type WatchGroup,
  type WatchRead,
  type WatchRow,
} from "@/lib/client-watch/shape";

/**
 * What the Home page shows, worked out from data other pages already load:
 * the Response Report's rows (Basecamp) and Monthly reports' list for one month.
 * Nothing here reads or writes; it only narrows and counts.
 *
 * "My clients" are the clients whose Strategist on the Master Sheet (column I)
 * names the viewer, alone or shared ("Daniel/Tom" counts for both). Tom chose
 * the sheet over the strategist fields stored on each client (Nov 25, 2026):
 * those were filled once by hand and don't follow the sheet. Every working
 * strategist is an admin, so the access rules show them every client; this
 * filter is what keeps Home personal.
 */

export type HomeView = "mine" | "all";

/** One line of the "By strategist" table, named as on the Master Sheet. */
export type StrategistLine = {
  strategist: string;
  /** Clients on the Response Report roster under this strategist. */
  clients: number;
  waitingOnUs: number;
  /** Waiting on us 7 days or more. */
  overdue: number;
  notHeard: number;
  /** Reports for the month that aren't marked sent. */
  reportsNotSent: number;
};

export type HomeSummary = {
  /** Clients whose last message needs a reply from us, longest wait first. */
  waiting: ShapedReportRow[];
  /** Waiting on us 7 days or more. */
  overdue: number;
  /** "Haven't heard from us" (see HEARD_THRESHOLDS). */
  notHeard: number;
  /** Clients on the Response Report roster in this view. */
  rosterClients: number;
  reportCounts: StateCounts;
  /** Clients in this view whose report for the month isn't marked sent, in list order. */
  reportsNotSent: MonthlyListRow[];
  reportClients: number;
  /** Everyone view only: one line per strategist on the sheet. Empty for My clients. */
  byStrategist: StrategistLine[];
};

export const NO_STRATEGIST = NO_STRATEGIST_ON_SHEET;

export function buildHomeSummary({
  reportRows,
  monthlyRows,
  view,
  mine,
  sheetStrategist,
}: {
  reportRows: ResponseReportRow[];
  monthlyRows: MonthlyListRow[];
  view: HomeView;
  /** Client ids whose sheet Strategist names the viewer. Only read for the My clients view. */
  mine: ReadonlySet<number>;
  /**
   * Each roster client's Strategist (column I on the Master Sheet), by client id.
   * Monthly reports name strategists from the same column, so the table's two
   * halves agree. Rows with no roster entry fall back to the client record's name.
   */
  sheetStrategist: ReadonlyMap<number, string | null>;
}): HomeSummary {
  // A Basecamp row with no client behind it can't be anyone's, so My clients leaves it out.
  const inView = (clientId: number | null) => view === "all" || (clientId != null && mine.has(clientId));

  const shaped = shapeAndSort(reportRows.filter((row) => inView(row.client_id)));
  const waiting = shaped
    .filter((row) => row.status === "awaiting_us" && !isDismissed(row))
    .sort((a, b) => (b.waitingDays ?? -1) - (a.waitingDays ?? -1) || a.account_name.localeCompare(b.account_name));
  const monthly = monthlyRows.filter((row) => inView(row.clientId));
  const notSent = monthly.filter((row) => row.state !== "sent");

  return {
    waiting,
    overdue: waiting.filter((row) => waitTone(row.waitingDays) === "overdue").length,
    notHeard: shaped.filter((row) => row.notHeard).length,
    rosterClients: shaped.length,
    reportCounts: countStates(monthly.map((row) => row.state)),
    reportsNotSent: notSent,
    reportClients: monthly.length,
    byStrategist: view === "all" ? strategistLines(shaped, monthly, sheetStrategist) : [],
  };
}

function strategistLines(
  rows: ShapedReportRow[],
  monthly: MonthlyListRow[],
  sheetStrategist: ReadonlyMap<number, string | null>,
): StrategistLine[] {
  const lines = new Map<string, StrategistLine>();
  const line = (name: string | null) => {
    const strategist = name?.trim() || NO_STRATEGIST;
    let found = lines.get(strategist);
    if (!found) {
      found = { strategist, clients: 0, waitingOnUs: 0, overdue: 0, notHeard: 0, reportsNotSent: 0 };
      lines.set(strategist, found);
    }
    return found;
  };
  for (const row of rows) {
    const onSheet = row.client_id != null && sheetStrategist.has(row.client_id);
    const entry = line(onSheet ? (sheetStrategist.get(row.client_id!) ?? null) : row.marketing_strategist);
    entry.clients += 1;
    if (row.status === "awaiting_us" && !isDismissed(row)) {
      entry.waitingOnUs += 1;
      if (waitTone(row.waitingDays) === "overdue") entry.overdue += 1;
    }
    if (row.notHeard) entry.notHeard += 1;
  }
  for (const row of monthly) {
    if (row.state !== "sent") line(row.strategist).reportsNotSent += 1;
  }
  return [...lines.values()].sort((a, b) =>
    a.strategist === NO_STRATEGIST ? 1 : b.strategist === NO_STRATEGIST ? -1 : a.strategist.localeCompare(b.strategist),
  );
}

/** Report states have been saved since this day; earlier work has no record. */
export const REPORT_TRACKING_BEGAN = "2026-11-25";

/**
 * True for a month whose reports were mostly done before tracking began, so
 * "Not started" there can mean "no record" rather than "not done".
 */
export function predatesReportTracking(month: string): boolean {
  return month < REPORT_TRACKING_BEGAN.slice(0, 7);
}

/**
 * The names the viewer goes by in the sheet's Strategist column: the first word
 * of their profile name ("Tom"), or of their email when the profile has no name.
 * Lower case, for comparing.
 */
export function viewerSheetNames(profile: { full_name?: string | null; email?: string | null } | null): string[] {
  const fromName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";
  const fromEmail = profile?.email?.split("@")[0]?.split(/[._-]/)[0] ?? "";
  const name = (fromName || fromEmail).toLowerCase();
  return name ? [name] : [];
}

/** True when a sheet Strategist value ("Daniel/Tom", "Alex") names one of these people. */
export function strategistNames(value: string | null | undefined, names: readonly string[]): boolean {
  if (!value || names.length === 0) return false;
  return value
    .split(/[/&,+]/)
    .map((part) => part.trim().toLowerCase())
    .some((part) => names.includes(part));
}

/** ?view=mine|all wins; otherwise My clients when the viewer has any, else Everyone. */
export function chooseHomeView(requested: unknown, assignedCount: number): HomeView {
  if (requested === "mine" || requested === "all") return requested;
  return assignedCount > 0 ? "mine" : "all";
}

// --- Client Watch on Home ----------------------------------------------------

export type HomeWatch = {
  groups: WatchGroup[];
  totals: { clients: number; oweResponse: number; unhappy: number; reportBehind: number; notRead: number };
  /** Everyone view: Client Watch counts per strategist, keyed like the By strategist lines. */
  byStrategist: Map<string, StrategistCounts>;
};

/**
 * Client Watch rows for this view: one per roster client (two practices on
 * one Basecamp project are still two clients), named by the sheet's
 * Strategist, beside the client's newest read.
 */
export function buildHomeWatch({
  reportRows,
  latest,
  attempts,
  view,
  mine,
  sheetStrategist,
  now,
}: {
  reportRows: ResponseReportRow[];
  latest: ReadonlyMap<number, WatchRead>;
  attempts: ReadonlyMap<number, WatchRead>;
  view: HomeView;
  mine: ReadonlySet<number>;
  sheetStrategist: ReadonlyMap<number, string | null>;
  now: Date;
}): HomeWatch {
  const seen = new Set<number>();
  const rows: WatchRow[] = [];
  for (const row of reportRows) {
    const id = row.client_id;
    if (id == null || seen.has(id)) continue;
    if (view === "mine" && !mine.has(id)) continue;
    seen.add(id);
    const strategist = sheetStrategist.has(id) ? (sheetStrategist.get(id) ?? null) : row.marketing_strategist;
    rows.push(toWatchRow(row, strategist, latest.get(id) ?? null, attempts.get(id) ?? null));
  }
  const counts = countByStrategist(rows, now);
  const total = counts[counts.length - 1];
  return {
    groups: groupByStrategist(rows),
    totals: {
      clients: total?.clients ?? 0,
      oweResponse: total?.oweResponse ?? 0,
      unhappy: total?.unhappy ?? 0,
      reportBehind: total?.reportBehind ?? 0,
      notRead: total?.notRead ?? 0,
    },
    byStrategist: new Map(counts.slice(0, -1).map((line) => [line.strategist, line])),
  };
}
