import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";

// Shared shaping for the response report so the page and the daily email
// describe the same thing. Pure functions — the data comes from the view.

export type ReportStatus = "awaiting_us" | "awaiting_client" | "no_contact";

/** The report's tabs, in order. The page opens on the first. */
export type StatusFilter = "all" | ReportStatus;
export const STATUS_FILTERS: StatusFilter[] = ["awaiting_us", "awaiting_client", "no_contact", "all"];

export type ShapedReportRow = ResponseReportRow & {
  status: ReportStatus;
  /** Someone marked the client's last message as needing no reply. */
  acknowledged: boolean;
  /** Days the ball has been in someone's court. Null when nobody has spoken. */
  waitingDays: number | null;
};

export function statusOf(row: ResponseReportRow): ReportStatus {
  if (!row.last_internal_at && !row.last_client_at) return "no_contact";
  return row.client_spoke_last ? "awaiting_us" : "awaiting_client";
}

export function isAcknowledged(row: ResponseReportRow): boolean {
  if (!row.last_client_at || !row.reply_acknowledged_for_occurred_at) return false;
  return (
    new Date(row.last_client_at).getTime() <=
    new Date(row.reply_acknowledged_for_occurred_at).getTime()
  );
}

export function shapeRow(row: ResponseReportRow): ShapedReportRow {
  const status = statusOf(row);
  return {
    ...row,
    status,
    acknowledged: isAcknowledged(row),
    waitingDays:
      status === "awaiting_us"
        ? row.days_since_client_contact
        : status === "awaiting_client"
          ? row.days_since_our_reply
          : null,
  };
}

// Waiting-on-us first and longest wait at the top — the report is read to
// decide who to answer this morning, so the overdue replies lead.
const STATUS_RANK: Record<ReportStatus, number> = {
  awaiting_us: 0,
  awaiting_client: 1,
  no_contact: 2,
};

export function shapeAndSort(rows: ResponseReportRow[]): ShapedReportRow[] {
  return rows.map(shapeRow).sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    // Acknowledged rows are handled — sink them below the ones still open.
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    const wait = (b.waitingDays ?? -1) - (a.waitingDays ?? -1);
    if (wait !== 0) return wait;
    return a.account_name.localeCompare(b.account_name);
  });
}

export type ReportSummary = {
  total: number;
  awaitingUs: number;
  awaitingClient: number;
  noContact: number;
  /** Awaiting us and untouched for a week or more. */
  overdue: number;
};

/**
 * How long a client may wait on us before it looks bad. One place, so the
 * badge colours, the age groups and the tiles always agree.
 */
export const WAIT_THRESHOLDS = { overdueDays: 7, agingDays: 3 } as const;

export const OVERDUE_DAYS = WAIT_THRESHOLDS.overdueDays;

export function summarizeReport(rows: ShapedReportRow[]): ReportSummary {
  const open = rows.filter((r) => r.status === "awaiting_us" && !r.acknowledged);
  return {
    total: rows.length,
    awaitingUs: open.length,
    awaitingClient: rows.filter((r) => r.status === "awaiting_client").length,
    noContact: rows.filter((r) => r.status === "no_contact").length,
    overdue: open.filter((r) => (r.waitingDays ?? 0) >= OVERDUE_DAYS).length,
  };
}

/** Teammates who posted last on at least one project, most projects first. */
export function internalAuthors(rows: ShapedReportRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.last_internal_author?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

// --- Triage view (Response Report redesign, phase 1) -----------------------

export type WaitTone = "overdue" | "aging" | "fresh";

export function waitTone(days: number | null): WaitTone {
  if (days != null && days >= WAIT_THRESHOLDS.overdueDays) return "overdue";
  if (days != null && days >= WAIT_THRESHOLDS.agingDays) return "aging";
  return "fresh";
}

/**
 * Dismissed: the client spoke last, but someone marked that message as needing
 * no reply. Kept in its own group, never among the rows that need action.
 */
export function isDismissed(row: ShapedReportRow): boolean {
  return row.status === "awaiting_us" && row.acknowledged;
}

export type AgeGroup = { tone: WaitTone; label: string; rows: ShapedReportRow[] };

/** Rows waiting on us, grouped 7+ / 3–6 / under 3 days, oldest first in each. */
export function groupByWait(rows: ShapedReportRow[]): AgeGroup[] {
  const { overdueDays, agingDays } = WAIT_THRESHOLDS;
  const groups: AgeGroup[] = [
    { tone: "overdue", label: `${overdueDays}+ days`, rows: [] },
    { tone: "aging", label: `${agingDays}–${overdueDays - 1} days`, rows: [] },
    { tone: "fresh", label: `Under ${agingDays} days`, rows: [] },
  ];
  for (const row of rows) {
    if (row.status !== "awaiting_us" || isDismissed(row)) continue;
    groups.find((group) => group.tone === waitTone(row.waitingDays))!.rows.push(row);
  }
  for (const group of groups) {
    group.rows.sort(
      (a, b) => (b.waitingDays ?? -1) - (a.waitingDays ?? -1) || a.account_name.localeCompare(b.account_name),
    );
  }
  return groups;
}

export type ReportTiles = {
  waitingOnUs: number;
  waitingOverdue: number;
  oldest: { days: number; name: string } | null;
  waitingOnClient: number;
};

export function reportTiles(rows: ShapedReportRow[]): ReportTiles {
  const open = rows.filter((row) => row.status === "awaiting_us" && !isDismissed(row));
  const oldest = open.reduce<ShapedReportRow | null>(
    (best, row) => ((row.waitingDays ?? -1) > (best?.waitingDays ?? -1) ? row : best),
    null,
  );
  return {
    waitingOnUs: open.length,
    waitingOverdue: open.filter((row) => waitTone(row.waitingDays) === "overdue").length,
    oldest: oldest && oldest.waitingDays != null ? { days: oldest.waitingDays, name: oldest.account_name } : null,
    waitingOnClient: rows.filter((row) => row.status === "awaiting_client").length,
  };
}
