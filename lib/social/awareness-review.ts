import type { SocialAwarenessDay } from "./types";

/**
 * The state of the celebration calendar as a review job.
 *
 * The planner only uses days that are `verified` and `is_active` — everything
 * else is a backlog it silently ignores. This makes that backlog visible, and
 * puts a prompt on screen during the window when governing bodies publish the
 * following year's dates.
 *
 * Most entries are rules (`week_of`, `nth_weekday`) rather than fixed dates, so
 * a correct rule regenerates itself every year. The review is about confirming
 * the rule still matches its source, not retyping dates.
 */

/** Months when next year's dates get confirmed against their sources. */
export const REVIEW_MONTHS = [12, 1];

export type AwarenessReview = {
  total: number;
  verified: number;
  unverified: SocialAwarenessDay[];
  /** Verified but with no source_url, so there is nothing to re-check against. */
  missingSource: SocialAwarenessDay[];
  /** True during the December/January review window. */
  inReviewWindow: boolean;
  /** The year being confirmed: next year in December, this year in January. */
  yearUnderReview: number;
  headline: string;
};

export function reviewAwarenessDays(
  days: SocialAwarenessDay[],
  now: Date = new Date(),
): AwarenessReview {
  const unverified = days.filter((d) => !d.verified);
  const missingSource = days.filter((d) => d.verified && !d.source_url);

  const month = now.getUTCMonth() + 1;
  const inReviewWindow = REVIEW_MONTHS.includes(month);
  const yearUnderReview = month === 12 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();

  const headline = inReviewWindow
    ? `Time to confirm ${yearUnderReview} dates — ${days.length} to check against their sources.`
    : unverified.length > 0
      ? `${unverified.length} of ${days.length} dates are unverified and unusable by the planner.`
      : `All ${days.length} dates verified. Next review December ${now.getUTCFullYear()}.`;

  return {
    total: days.length,
    verified: days.length - unverified.length,
    unverified,
    missingSource,
    inReviewWindow,
    yearUnderReview,
    headline,
  };
}
