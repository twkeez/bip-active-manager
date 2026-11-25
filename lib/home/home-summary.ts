import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import { isDismissed, shapeAndSort, waitTone, type ShapedReportRow } from "@/lib/basecamp/response-report";
import type { MonthlyListRow } from "@/lib/reporting/monthly-list";
import { countStates, type StateCounts } from "@/lib/reporting/monthly";

/**
 * What the Home page shows, worked out from data other pages already load:
 * the Response Report's rows (Basecamp) and Monthly reports' list for one month.
 * Nothing here reads or writes; it only narrows and counts.
 *
 * "My clients" are the clients assigned to the viewer (clients.strategist_user_id
 * or strategist_user_ids). Every working strategist is an admin today, so the
 * access rules show them every client; this filter is what keeps Home personal.
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

export const NO_STRATEGIST = "No strategist on the sheet";

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
  /** Client ids assigned to the viewer. Only read for the My clients view. */
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

/** ?view=mine|all wins; otherwise My clients when the viewer has any, else Everyone. */
export function chooseHomeView(requested: unknown, assignedCount: number): HomeView {
  if (requested === "mine" || requested === "all") return requested;
  return assignedCount > 0 ? "mine" : "all";
}
