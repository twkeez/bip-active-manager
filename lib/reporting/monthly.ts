/**
 * MONTHLY REPORTS: which month a report is for, and how far along it is.
 *
 * Each client with a Package gets one report a month. Its state is one of:
 *
 *   Not started  nothing saved for that month yet
 *   Draft        a strategist has started it
 *   Reviewed     someone checked it and it's ready to send
 *   Sent         it went to the client (how is recorded: Snapshot link, PDF…)
 *
 * The states live in public.monthly_reports, one row per client and month
 * (supabase/migrations/20261125200000_monthly_reports.sql). "Not started" is
 * the absence of a row.
 *
 * A month is written "YYYY-MM" in URLs and the app, and stored as the first
 * day of that month.
 */

export type MonthKey = `${number}-${string}`;

export const REPORT_STATES = ["not_started", "draft", "reviewed", "sent"] as const;
export type ReportState = (typeof REPORT_STATES)[number];
/** The states that are stored; "not_started" is the absence of a row. */
export type StoredReportState = Exclude<ReportState, "not_started">;
export const STORED_REPORT_STATES: StoredReportState[] = ["draft", "reviewed", "sent"];

export const STATE_LABELS: Record<ReportState, string> = {
  not_started: "Not started",
  draft: "Draft",
  reviewed: "Reviewed",
  sent: "Sent",
};

/** How a report reached the client. Matches the check on monthly_reports.sent_via. */
export const SENT_VIA = ["snapshot", "pdf", "word", "other"] as const;
export type SentVia = (typeof SENT_VIA)[number];
export const SENT_VIA_LABELS: Record<SentVia, string> = {
  snapshot: "Snapshot link",
  pdf: "PDF",
  word: "Word",
  other: "Other",
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function key(year: number, monthIndex: number): MonthKey {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}` as MonthKey;
}

/** True for a well-formed "YYYY-MM". */
export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/**
 * The month reports are usually being written for: the one that just ended.
 * Reports for October are prepared in early November. Uses the server's clock
 * in UTC, so the switch happens at midnight UTC on the 1st.
 */
export function defaultReportMonth(now: Date = new Date()): MonthKey {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month === 0 ? key(year - 1, 11) : key(year, month - 1);
}

/**
 * The report month a Client Snapshot counts toward: the month most of its days
 * fall in. A snapshot holds about the 30 days before it was published, so this
 * is the month of the day 15 days before publishing (UTC). Published Dec 3, it
 * is November's report; published Nov 28, it is November's too.
 */
export function snapshotReportMonth(publishedAt: Date | string): MonthKey {
  const middle = new Date(new Date(publishedAt).getTime() - 15 * 86_400_000);
  return key(middle.getUTCFullYear(), middle.getUTCMonth());
}

/** The month asked for, or the default when none (or nonsense) was given. Never a future month. */
export function parseReportMonth(value: unknown, now: Date = new Date()): MonthKey {
  if (!isMonthKey(value)) return defaultReportMonth(now);
  const current = key(now.getUTCFullYear(), now.getUTCMonth());
  return value > current ? defaultReportMonth(now) : value;
}

/** "2026-10" → "2026-10-01", the value stored in monthly_reports.month. */
export function monthStartDate(month: MonthKey): string {
  return `${month}-01`;
}

/** "2026-10" → "October": the month alone, as client emails name it. */
export function monthName(month: MonthKey): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return month;
  return MONTH_NAMES[Number(match[2]) - 1];
}

/** "2026-10" → "October 2026". */
export function monthLabel(month: MonthKey): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return month;
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** The current month and the ones before it, newest first. */
export function recentMonths(count: number, now: Date = new Date()): MonthKey[] {
  const out: MonthKey[] = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  for (let i = 0; i < count; i += 1) {
    out.push(key(year, month));
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return out;
}

/** A stored row's state, or Not started when there is no row (or an unknown value). */
export function stateOf(row: { status: string } | null | undefined): ReportState {
  const status = row?.status;
  return status === "draft" || status === "reviewed" || status === "sent" ? status : "not_started";
}

export function isStoredState(value: unknown): value is StoredReportState {
  return value === "draft" || value === "reviewed" || value === "sent";
}

/** Keeps only known ways of sending, once each. */
export function parseSentVia(value: unknown): SentVia[] {
  if (!Array.isArray(value)) return [];
  return SENT_VIA.filter((via) => value.includes(via));
}

export type StateCounts = Record<ReportState, number>;

export function countStates(states: readonly ReportState[]): StateCounts {
  const counts: StateCounts = { not_started: 0, draft: 0, reviewed: 0, sent: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}

/** The step a report in this state moves to next, or null once it's sent. */
export function nextState(state: ReportState): StoredReportState | null {
  if (state === "not_started") return "draft";
  if (state === "draft") return "reviewed";
  if (state === "reviewed") return "sent";
  return null;
}

/** The migration that creates monthly_reports, named wherever the app says it's missing. */
export const MONTHLY_REPORTS_MIGRATION = "supabase/migrations/20261125200000_monthly_reports.sql";

/** True when a Supabase error means monthly_reports doesn't exist yet. */
export function isMissingMonthlyTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /monthly_reports/.test(error.message ?? "") && /does not exist|could not find/i.test(error.message ?? "");
}
