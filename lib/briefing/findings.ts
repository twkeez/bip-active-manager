import type { BriefingFinding, FindingLevel } from "@/lib/briefing/types";

/**
 * Turning a client's stored numbers into things worth telling their strategist.
 *
 * Every function here is pure: rows in, findings out. The thresholds are the
 * whole design, so they are named and explained rather than inlined — the
 * difference between a briefing people read and one they filter is entirely in
 * what it decides to leave out.
 *
 * Two rules run through all of it:
 *
 * 1. No percentages off small numbers. Three calls becoming one is a 67% drop
 *    and means nothing; a practice does not need a fortnightly alert about
 *    ordinary noise. Every comparison has a floor.
 * 2. Good news counts as a finding. A note that only ever carries problems
 *    trains people to open it with dread and then not at all.
 */

/** Below these, a change is noise and is not reported as a percentage. */
export const MIN_CONVERSIONS = 5;
export const MIN_CLICKS = 40;
export const MIN_REACH = 200;

/** A change has to be this big before it is worth a line. */
export const DROP_NEEDS_YOU = 0.3;
export const DROP_WATCH = 0.2;
export const RISE_GOOD = 0.25;

/** Social: a client buying social with nothing posted for this long is a problem. */
export const POSTING_GAP_DAYS = 14;

/** Reviews at or below this need answering, whatever else is happening. */
export const POOR_REVIEW_RATING = 2;
export const RATING_DROP_WATCH = 0.2;

export type Period = { current: number; previous: number };

const pct = (period: Period) =>
  period.previous === 0 ? null : (period.current - period.previous) / period.previous;

const whole = (value: number) => Math.round(value).toLocaleString("en-US");

const percentText = (change: number) => `${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change * 100))}%`;

/**
 * One comparison, reported only if it is big enough and the base is real.
 * Returns null when there is nothing worth saying, which is most of the time.
 */
export function compare({
  id,
  scope,
  period,
  floor,
  noun,
  fallingIsBad = true,
}: {
  id: string;
  scope: BriefingFinding["scope"];
  period: Period;
  /** The smaller of the two periods must reach this to be worth comparing. */
  floor: number;
  /** "calls", "clicks from Google", "people reached". */
  noun: string;
  /** False where a rise is the bad direction, e.g. cost per call. */
  fallingIsBad?: boolean;
}): BriefingFinding | null {
  if (Math.max(period.current, period.previous) < floor) return null;
  const change = pct(period);
  if (change === null || !Number.isFinite(change)) return null;

  const bad = fallingIsBad ? change < 0 : change > 0;
  const size = Math.abs(change);
  let level: FindingLevel | null = null;
  if (bad && size >= DROP_NEEDS_YOU) level = "needs_you";
  else if (bad && size >= DROP_WATCH) level = "watch";
  else if (!bad && size >= RISE_GOOD) level = "good";
  if (!level) return null;

  return {
    id,
    scope,
    level,
    headline: `${noun[0].toUpperCase()}${noun.slice(1)} ${percentText(change)} on the previous month`,
    metric: `${whole(period.previous)} → ${whole(period.current)}`,
  };
}

// ---------------------------------------------------------------------------
// Stored signals
// ---------------------------------------------------------------------------

/**
 * The ads, social and Search Console syncs already write signals in one shape,
 * each with a severity the tools agreed on. Those are the findings someone
 * already decided were worth raising, so the briefing carries them rather than
 * inventing a second opinion — capped, because a client with eleven keyword
 * warnings needs a conversation, not a longer email.
 */
export type StoredSignal = {
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description?: string | null;
  metric_value?: string | null;
};

export const SIGNALS_PER_SERVICE = 2;

/**
 * Stored signals carry their own numbers, and some are volume-based — so a
 * signal can be true and still be noise. The social sync reported "reach
 * dropped 50%" off five people against ten, which is exactly the finding the
 * floors above exist to prevent; it arrived pre-baked from another tool
 * instead of being computed here.
 *
 * So volume-based signals get a floor too, read from the numbers in their own
 * metric text. Signals not listed here are not about volume and pass through.
 */
export const SIGNAL_FLOORS: Record<string, number> = {
  reach_drop_week_over_week: 100,
  high_post_variance: 25,
  engagement_drop: 50,
};

/** The largest plain number in a signal's metric text, e.g. "(5 vs 10)" → 10. */
export function largestNumber(text: string | null | undefined): number | null {
  const numbers = (text ?? "")
    .replace(/[,$]/g, "")
    // Percentages describe the change, not the size of what changed.
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .match(/\d+(\.\d+)?/g);
  if (!numbers) return null;
  return Math.max(...numbers.map(Number));
}

function tooSmallToMention(signal: StoredSignal): boolean {
  const floor = SIGNAL_FLOORS[signal.signal_id];
  if (floor === undefined) return false;
  const size = largestNumber(signal.metric_value);
  return size !== null && size < floor;
}

export function signalFindings(
  signals: StoredSignal[],
  scope: BriefingFinding["scope"],
  { cap = SIGNALS_PER_SERVICE }: { cap?: number } = {},
): BriefingFinding[] {
  const ranked = [...signals]
    .filter((signal) => !tooSmallToMention(signal))
    .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));
  // The same signal can be stored once per snapshot; one line each is enough.
  const seen = new Set<string>();
  const unique = ranked.filter((signal) => {
    if (seen.has(signal.signal_id)) return false;
    seen.add(signal.signal_id);
    return true;
  });

  return unique.slice(0, cap).map((signal) => ({
    id: `signal:${scope}:${signal.signal_id}`,
    scope,
    level: signal.severity === "critical" ? "needs_you" : "watch",
    headline: signal.title,
    detail: signal.description ?? null,
    metric: signal.metric_value ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type ReviewRow = {
  author_name?: string | null;
  rating?: number | null;
  review_time_unix?: number | null;
};

/**
 * Reviews are the one thing a practice expects us to notice the day it
 * happens, and the only finding here that is about a single event rather than
 * a trend. A one-star review three weeks unanswered is the worst thing a
 * briefing can fail to mention.
 */
export function reviewFindings({
  rating,
  previousRating,
  reviewCount,
  previousReviewCount,
  reviews,
  now = Date.now(),
  windowDays = 30,
}: {
  rating: number | null;
  previousRating: number | null;
  reviewCount: number | null;
  previousReviewCount: number | null;
  reviews: ReviewRow[];
  now?: number;
  windowDays?: number;
}): BriefingFinding[] {
  const findings: BriefingFinding[] = [];
  const since = (now - windowDays * 86_400_000) / 1000;
  const recent = reviews.filter(
    (review) => typeof review.review_time_unix === "number" && review.review_time_unix >= since,
  );

  const poor = recent.filter(
    (review) => typeof review.rating === "number" && review.rating <= POOR_REVIEW_RATING,
  );
  if (poor.length > 0) {
    findings.push({
      id: "reviews:poor",
      scope: "orm",
      level: "needs_you",
      headline:
        poor.length === 1
          ? "A new review of 2 stars or less needs a reply"
          : `${poor.length} new reviews of 2 stars or less need replies`,
      detail: poor
        .slice(0, 3)
        .map((review) => `${review.rating}★ from ${review.author_name ?? "someone"}`)
        .join(", "),
    });
  }

  if (rating !== null && previousRating !== null) {
    const move = rating - previousRating;
    if (move <= -RATING_DROP_WATCH) {
      findings.push({
        id: "reviews:rating-down",
        scope: "orm",
        level: "watch",
        headline: "Their Google rating has slipped",
        metric: `${previousRating.toFixed(1)} → ${rating.toFixed(1)}`,
      });
    } else if (move >= RATING_DROP_WATCH) {
      findings.push({
        id: "reviews:rating-up",
        scope: "orm",
        level: "good",
        headline: "Their Google rating has gone up",
        metric: `${previousRating.toFixed(1)} → ${rating.toFixed(1)}`,
      });
    }
  }

  const gained = (reviewCount ?? 0) - (previousReviewCount ?? 0);
  if (previousReviewCount !== null && gained >= 3 && poor.length === 0) {
    findings.push({
      id: "reviews:new",
      scope: "orm",
      level: "good",
      headline: `${gained} new Google reviews since the last briefing`,
      metric: `${whole(previousReviewCount)} → ${whole(reviewCount ?? 0)} reviews`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Posting gap
// ---------------------------------------------------------------------------

/** A social client with nothing posted lately — measured, not assumed. */
export function postingGapFinding({
  lastPostAt,
  now = Date.now(),
}: {
  lastPostAt: string | null;
  now?: number;
}): BriefingFinding | null {
  if (!lastPostAt) return null;
  const days = Math.floor((now - new Date(lastPostAt).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < POSTING_GAP_DAYS) return null;
  return {
    id: "social:posting-gap",
    scope: "smm",
    level: days >= POSTING_GAP_DAYS * 2 ? "needs_you" : "watch",
    headline: `Nothing has been posted for ${days} days`,
    metric: `last post ${lastPostAt.slice(0, 10)}`,
  };
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<FindingLevel, number> = { needs_you: 0, watch: 1, good: 2 };

/**
 * What the briefing actually says, in order.
 *
 * Three is the cap, from the same reasoning as the client document: past
 * three items a fortnightly note reads as a report and gets skimmed. One piece
 * of good news is allowed through even when three problems are queued, because
 * a note with no good news in it is a note nobody wants to open — but it never
 * takes a "needs you" slot.
 */
export const FINDINGS_SHOWN = 3;

export function rankFindings(findings: BriefingFinding[], cap = FINDINGS_SHOWN): BriefingFinding[] {
  const sorted = [...findings].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const serious = sorted.filter((finding) => finding.level !== "good").slice(0, cap);
  const good = sorted.find((finding) => finding.level === "good");
  if (!good) return serious;
  return serious.length < cap ? [...serious, good] : [...serious.slice(0, cap - 1), good];
}

export function needsAttention(findings: BriefingFinding[]): boolean {
  return findings.some((finding) => finding.level !== "good");
}
