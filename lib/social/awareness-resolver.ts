import type { SocialAwarenessDay } from "./types";

// Turns a stored awareness-day rule into concrete dates for a given year.
// Pure functions — no database, no side effects.
//
// All dates are built in UTC so they never drift across timezones. Read them
// with getUTCFullYear/getUTCMonth/getUTCDate, or `d.toISOString().slice(0, 10)`
// for the YYYY-MM-DD form Postgres date columns use.
//
// `end` is INCLUSIVE and is null for single-day rules ('fixed', 'nth_weekday').

export type ResolvedAwarenessDate = {
  start: Date;
  end: Date | null;
};

/** A rule with fields the resolver needs — accepts a full row or a literal. */
export type AwarenessRule = Pick<
  SocialAwarenessDay,
  "rule_type" | "month" | "day" | "nth" | "weekday" | "week_start_day" | "duration_days"
>;

const DAY_MS = 86_400_000;

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The date of the nth `weekday` in a month. `nth` is 1..5, or -1 for the last
 * occurrence. Returns null when that occurrence doesn't exist (e.g. a 5th
 * Monday in a month that only has four).
 *
 * Examples:
 *   nthWeekdayOfMonth(2026, 10, 3, 0)  => 2026-10-18  (3rd Sunday of Oct 2026)
 *   nthWeekdayOfMonth(2026, 5, -1, 1)  => 2026-05-25  (last Monday of May 2026)
 *   nthWeekdayOfMonth(2026, 10, 5, 0)  => null        (no 5th Sunday)
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  nth: number,
  weekday: number,
): Date | null {
  const total = daysInMonth(year, month);

  if (nth === -1) {
    const last = utc(year, month, total);
    const back = (last.getUTCDay() - weekday + 7) % 7;
    return addDays(last, -back);
  }

  const first = utc(year, month, 1);
  const forward = (weekday - first.getUTCDay() + 7) % 7;
  const dayOfMonth = 1 + forward + (nth - 1) * 7;
  if (dayOfMonth > total) return null; // that occurrence doesn't exist
  return utc(year, month, dayOfMonth);
}

/**
 * Resolve a stored rule to { start, end } for `year`.
 *
 * Throws on rows that violate the database CHECK constraint (missing fields for
 * the declared rule_type), or when an nth-weekday occurrence doesn't exist in
 * that month/year.
 *
 * ── Worked examples (these are the cases the schema spec calls out) ──
 *
 * week_of, nth-weekday start — National Veterinary Technician Week:
 *   { rule_type: 'week_of', month: 10, nth: 3, weekday: 0, duration_days: 7 }, 2026
 *   Oct 1 2026 is a Thursday -> first Sunday is Oct 4 -> third Sunday is Oct 18.
 *   => start 2026-10-18, end 2026-10-24
 *
 * week_of, fixed start — Walk Your Dog Week:
 *   { rule_type: 'week_of', month: 10, week_start_day: 1, duration_days: 7 }, 2026
 *   => start 2026-10-01, end 2026-10-07
 *
 * nth_weekday with nth = -1 — last Monday of May (Memorial Day):
 *   { rule_type: 'nth_weekday', month: 5, nth: -1, weekday: 1 }, 2026
 *   => start 2026-05-25, end null
 *
 * fixed — National Bird Day:
 *   { rule_type: 'fixed', month: 1, day: 5 }, 2026
 *   => start 2026-01-05, end null
 *
 * month_long — National Pet Dental Health Month:
 *   { rule_type: 'month_long', month: 2 }, 2026
 *   => start 2026-02-01, end 2026-02-28   (2026 is not a leap year)
 */
export function resolveAwarenessDate(
  rule: AwarenessRule,
  year: number,
): ResolvedAwarenessDate {
  switch (rule.rule_type) {
    case "fixed": {
      if (rule.day == null) {
        throw new Error("fixed rule requires day");
      }
      return { start: utc(year, rule.month, rule.day), end: null };
    }

    case "nth_weekday": {
      if (rule.nth == null || rule.weekday == null) {
        throw new Error("nth_weekday rule requires nth and weekday");
      }
      const start = nthWeekdayOfMonth(year, rule.month, rule.nth, rule.weekday);
      if (!start) {
        throw new Error(
          `nth_weekday rule has no occurrence ${rule.nth} of weekday ${rule.weekday} in ${year}-${rule.month}`,
        );
      }
      return { start, end: null };
    }

    case "week_of": {
      if (rule.duration_days == null) {
        throw new Error("week_of rule requires duration_days");
      }
      let start: Date | null;

      if (rule.week_start_day != null) {
        // Form (a): the week begins on a fixed day of the month.
        start = utc(year, rule.month, rule.week_start_day);
      } else if (rule.nth != null && rule.weekday != null) {
        // Form (b): the week begins on the nth weekday of the month.
        start = nthWeekdayOfMonth(year, rule.month, rule.nth, rule.weekday);
        if (!start) {
          throw new Error(
            `week_of rule has no occurrence ${rule.nth} of weekday ${rule.weekday} in ${year}-${rule.month}`,
          );
        }
      } else {
        throw new Error(
          "week_of rule requires either week_start_day, or both nth and weekday",
        );
      }

      // duration_days counts the start day itself, so a 7-day week ends +6.
      return { start, end: addDays(start, rule.duration_days - 1) };
    }

    case "month_long": {
      return {
        start: utc(year, rule.month, 1),
        end: utc(year, rule.month, daysInMonth(year, rule.month)),
      };
    }

    default: {
      const exhaustive: never = rule.rule_type;
      throw new Error(`Unknown rule_type: ${String(exhaustive)}`);
    }
  }
}

/** YYYY-MM-DD, matching the format Postgres date columns round-trip. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * True when `date` falls inside the rule's window for that date's year.
 * Single-day rules match only that exact day.
 */
export function isAwarenessDateActive(rule: AwarenessRule, date: Date): boolean {
  const { start, end } = resolveAwarenessDate(rule, date.getUTCFullYear());
  const target = toDateString(date);
  if (!end) return target === toDateString(start);
  return target >= toDateString(start) && target <= toDateString(end);
}
