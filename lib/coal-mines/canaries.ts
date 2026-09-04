import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Coal Mines — the checks that go quiet until something is wrong.
 *
 * A canary watches one thing and reports in a single line. It never fixes
 * anything and never writes: the point is to notice, early, the sort of drift
 * nobody is looking for. Harmony Animal Hospital was sold Ads Foundation in
 * February and still had no campaign in September because nothing was watching.
 *
 * Canaries run on page load today. Putting them on a schedule is the next step,
 * and nothing here assumes one — a canary is a pure "look and report" function.
 */

export type CanaryStatus = "ok" | "attention" | "overdue";

export type Canary = {
  key: string;
  name: string;
  /** What this canary watches, in plain language. */
  watches: string;
  status: CanaryStatus;
  /** One-line verdict. */
  headline: string;
  /** Specifics worth naming — rendered as a list under the headline. */
  detail: string[];
};

/** Months when we review next year's celebration dates. */
const REVIEW_MONTHS = [12, 1];

/**
 * Awareness dates drift: organisations publish next year's dates late in the
 * year, and a stale rule quietly puts a campaign on the wrong week. This fires
 * during the review window, and any time a day is sitting unverified.
 */
export async function checkAwarenessDates(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary> {
  const base = {
    key: "awareness-dates",
    name: "Celebration dates",
    watches:
      "Whether next year's awareness weeks and days have been checked against their source.",
  } as const;

  const { data, error } = await supabase
    .from("social_awareness_days")
    .select("name, month, verified, is_active, source_url")
    .order("month", { ascending: true });

  if (error) {
    return {
      ...base,
      status: "attention",
      headline: "Could not read the celebration calendar.",
      detail: [error.message],
    };
  }

  const days = data ?? [];
  const unverified = days.filter((d) => !d.verified);
  const missingSource = days.filter((d) => d.verified && !d.source_url);

  const month = now.getUTCMonth() + 1;
  const inReviewWindow = REVIEW_MONTHS.includes(month);
  // In December we are checking the year ahead; in January, the year we are in.
  const yearUnderReview = month === 12 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();

  const detail: string[] = [];
  if (unverified.length > 0) {
    detail.push(
      `Unverified: ${unverified.map((d) => d.name).slice(0, 8).join(", ")}` +
        (unverified.length > 8 ? ` and ${unverified.length - 8} more` : ""),
    );
  }
  if (missingSource.length > 0) {
    detail.push(`${missingSource.length} verified without a source link to re-check against.`);
  }

  if (inReviewWindow) {
    return {
      ...base,
      status: "overdue",
      headline: `Time to confirm ${yearUnderReview} dates — ${days.length} to check against their sources.`,
      detail,
    };
  }

  if (unverified.length > 0) {
    return {
      ...base,
      status: "attention",
      headline: `${unverified.length} of ${days.length} celebration dates are unverified.`,
      detail,
    };
  }

  return {
    ...base,
    status: "ok",
    headline: `All ${days.length} dates verified. Next review December ${now.getUTCFullYear()}.`,
    detail,
  };
}

/** Every canary, run together. Order is display order. */
export async function runCanaries(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary[]> {
  return Promise.all([checkAwarenessDates(supabase, now)]);
}
