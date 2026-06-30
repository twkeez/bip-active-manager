// Cadence helpers for recurring client SEO audits. Pure + side-effect free so
// they can be unit-tested and shared by the API routes and the dashboard.

export type CadenceMonths = 3 | 6;
export type DueStatus = "overdue" | "due" | "upcoming" | "none";

/** How many days before the due date we start surfacing it as "due". */
export const DUE_SOON_WINDOW_DAYS = 14;

export function isCadence(value: unknown): value is CadenceMonths {
  return value === 3 || value === 6;
}

/**
 * Next due date = the given moment plus the cadence, in calendar months.
 * Returns an ISO string. `from` defaults to now.
 */
export function computeNextDue(from: Date | string | null, cadenceMonths: CadenceMonths): string {
  const base = from ? new Date(from) : new Date();
  const next = new Date(base.getTime());
  // Work in UTC so the result doesn't drift across the host timezone / DST.
  next.setUTCMonth(next.getUTCMonth() + cadenceMonths);
  return next.toISOString();
}

/**
 * Classifies a schedule's next-due date relative to `now`:
 *  - overdue : due date has passed
 *  - due     : within the next DUE_SOON_WINDOW_DAYS
 *  - upcoming: further out
 *  - none    : no due date set
 */
export function dueStatus(nextDueAt: string | null, now: Date = new Date()): DueStatus {
  if (!nextDueAt) return "none";
  const due = new Date(nextDueAt).getTime();
  if (Number.isNaN(due)) return "none";
  const diffDays = (due - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= DUE_SOON_WINDOW_DAYS) return "due";
  return "upcoming";
}

/** True when an audit should be flagged for action (due or overdue). */
export function isActionable(nextDueAt: string | null, now: Date = new Date()): boolean {
  const status = dueStatus(nextDueAt, now);
  return status === "due" || status === "overdue";
}
