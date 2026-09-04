import { resolveAwarenessDate, type AwarenessRule } from "./awareness-resolver";

/**
 * Renders the reusable client-request message for a celebration day.
 *
 * The stored template carries placeholders rather than literal dates, so the
 * annual review only has to confirm the date rule and its source — the prose
 * never needs rewriting. Both dates are derived from the same rule the planner
 * already uses, so the message and the calendar can never disagree.
 */

const DAY_MS = 86_400_000;

export type RequestTemplateFields = {
  client_request_template: string | null;
  request_respond_by_days: number | null;
};

export type RenderedClientRequest = {
  message: string;
  /** Event window for the year, e.g. "October 18–24". */
  dateRange: string;
  /** Reply deadline, e.g. "Friday, September 25". Null when no offset is set. */
  respondBy: string | null;
  /** True once the deadline has passed — the ask is late for this year. */
  overdue: boolean;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "October 18–24", or "October 29 – November 2" when the window crosses a month. */
export function formatDateRange(start: Date, end: Date | null): string {
  const startMonth = MONTHS[start.getUTCMonth()];
  const startDay = start.getUTCDate();
  if (!end) return `${startMonth} ${startDay}`;

  const endDay = end.getUTCDate();
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay} – ${MONTHS[end.getUTCMonth()]} ${endDay}`;
}

/** "Friday, September 25" — the weekday matters, people scan for it. */
export function formatDeadline(date: Date): string {
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Returns null when this day has no client ask, which is true of most of them —
 * callers should render nothing rather than an empty panel.
 */
export function renderClientRequest(
  rule: AwarenessRule & RequestTemplateFields,
  year: number,
  now: Date = new Date(),
): RenderedClientRequest | null {
  const template = rule.client_request_template?.trim();
  if (!template) return null;

  const resolved = resolveAwarenessDate(rule, year);
  if (!resolved) return null;

  const dateRange = formatDateRange(resolved.start, resolved.end);

  let respondBy: string | null = null;
  let overdue = false;
  if (rule.request_respond_by_days != null) {
    const deadline = new Date(resolved.start.getTime() - rule.request_respond_by_days * DAY_MS);
    respondBy = formatDeadline(deadline);
    overdue = now.getTime() > deadline.getTime();
  }

  const message = template
    .replaceAll("{{date_range}}", dateRange)
    // A template that asks for a deadline it has no offset for would render an
    // empty gap; say so instead of silently dropping it.
    .replaceAll("{{respond_by}}", respondBy ?? "[no reply deadline set]")
    .replaceAll("{{year}}", String(year));

  return { message, dateRange, respondBy, overdue };
}
