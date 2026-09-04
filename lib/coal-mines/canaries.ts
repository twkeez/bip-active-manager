import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Coal Mines — the checks that stay quiet until something is wrong.
 *
 * A canary watches one thing and reports in a single line. It never fixes
 * anything and never writes: the point is to notice, early, the sort of drift
 * nobody is looking for. Harmony Animal Hospital was sold Ads Foundation in
 * February and still had no campaign in September because nothing was watching.
 *
 * What belongs here: cross-cutting checks with no natural home in a feature —
 * a service sold but never started, a sync that has stopped running, a client
 * paying for something we are not delivering. What does not belong here: work
 * that is part of a feature, which should live in that feature. The celebration
 * calendar review started here and moved to the Social Planner for that reason.
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

/** Every canary, run together. Order is display order. */
export async function runCanaries(
  _supabase: SupabaseClient,
  _now: Date = new Date(),
): Promise<Canary[]> {
  return [];
}
