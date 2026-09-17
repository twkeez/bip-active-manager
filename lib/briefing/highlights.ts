import type { BriefingScope } from "@/lib/briefing/types";

/**
 * The good news, for the practice to read.
 *
 * A strategist's quarterly note to a client is not a shorter version of the
 * internal one — it is a different document with a different job. Theirs reads:
 *
 *   • Website traffic increased 51%, with total website users up 73%…
 *   • Google Ads generated 1,204 clicks and 581 conversions…
 *
 * Concrete numbers, the client's own results, nothing about what we are
 * worrying over. Problems go to the strategist, who decides how and when to
 * raise them. So the engine produces two things from the same data, and this
 * half may only ever contain what is true and worth celebrating.
 *
 * Two kinds of highlight earn a place:
 *
 * - a rise worth naming, measured against the period before it; and
 * - a plain total, where the number speaks without a comparison ("generated
 *   581 calls and form fills").
 *
 * Nothing that fell. Not because it is hidden — the strategist has it — but
 * because a note that mixes "traffic up 51%" with "your rankings slipped" is
 * neither a celebration nor a plan, and lands as both.
 */

export type Highlight = {
  id: string;
  scope: BriefingScope;
  /** The finished bullet, in the client's language. */
  text: string;
};

/** A rise below this is ordinary movement, not an achievement. */
export const RISE_WORTH_SAYING = 0.15;

/** And it has to be a rise from something real. */
export const HIGHLIGHT_FLOORS = {
  reach: 200,
  clicks: 40,
  conversions: 5,
  sessions: 100,
  reviews: 2,
} as const;

const n = (value: number) => Math.round(value).toLocaleString("en-US");

const percent = (change: number) => `${Math.round(change * 100)}%`;

export type Period = { current: number; previous: number };

/**
 * "Facebook engagement increased 56%" — only when it rose enough, from a base
 * big enough that the percentage means something.
 */
export function risingHighlight({
  id,
  scope,
  noun,
  period,
  floor,
  withTotal = true,
}: {
  id: string;
  scope: BriefingScope;
  /** Reads after "Your": "website traffic", "Facebook engagement". */
  noun: string;
  period: Period;
  floor: number;
  /** Adds "(1,204 this month)" — off where the total is not meaningful. */
  withTotal?: boolean;
}): Highlight | null {
  if (period.previous <= 0) return null;
  if (Math.max(period.current, period.previous) < floor) return null;
  const change = (period.current - period.previous) / period.previous;
  if (!Number.isFinite(change) || change < RISE_WORTH_SAYING) return null;
  const total = withTotal ? ` (${n(period.current)} this month, up from ${n(period.previous)})` : "";
  return { id, scope, text: `${noun} increased ${percent(change)}${total}` };
}

/**
 * "Google Ads generated 1,204 clicks and 581 conversions" — a total worth
 * reporting whether or not it moved. Empty when there is nothing to report.
 */
export function totalHighlight({
  id,
  scope,
  text,
  value,
  floor,
}: {
  id: string;
  scope: BriefingScope;
  /** Takes the formatted number: (n) => `Google Ads brought ${n} visits`. */
  text: (formatted: string) => string;
  value: number;
  floor: number;
}): Highlight | null {
  if (!Number.isFinite(value) || value < floor) return null;
  return { id, scope, text: text(n(value)) };
}

/** Whole-number percentages read better than 48.26% in a client's inbox. */
export function rateText(part: number, whole: number): string | null {
  if (whole <= 0 || part < 0) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

export function moneyText(value: number): string {
  return value >= 100 ? `$${Math.round(value).toLocaleString("en-US")}` : `$${value.toFixed(2)}`;
}

/**
 * Five bullets is the length of the strategists' own notes: enough to feel like
 * a report, short enough to read in the Basecamp preview.
 */
export const HIGHLIGHTS_SHOWN = 5;

/**
 * A client note needs enough to be worth sending. One bullet reads as scraping
 * for something to say, and a practice paying every month notices.
 */
export const MIN_HIGHLIGHTS_TO_SEND = 2;

/**
 * The order the strategists' own notes use: the website overall, then what we
 * paid for, then what we earned, then social, then reviews. A note that opens
 * with 65 search visits and buries 1,967 website visits has buried the lead.
 */
const SCOPE_ORDER: Record<string, number> = {
  account: 0,
  ppc: 1,
  seo: 2,
  smm: 3,
  orm: 4,
  blog: 5,
};

export function selectHighlights(highlights: Highlight[]): Highlight[] {
  const seen = new Set<string>();
  return highlights
    .filter((highlight) => {
      if (seen.has(highlight.id)) return false;
      seen.add(highlight.id);
      return true;
    })
    .sort((a, b) => (SCOPE_ORDER[a.scope] ?? 9) - (SCOPE_ORDER[b.scope] ?? 9))
    .slice(0, HIGHLIGHTS_SHOWN);
}

export function worthSending(highlights: Highlight[]): boolean {
  return highlights.length >= MIN_HIGHLIGHTS_TO_SEND;
}
