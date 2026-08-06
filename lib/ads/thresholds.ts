// Canonical Google Ads impression-share thresholds — ONE source of truth so the
// per-account diagnostic, the cross-account roll-up (Global Ads Optimization),
// and the client signal feed stop disagreeing about when an account is "capped
// by budget" or "held back by rank". Values are percentages (0–100).
//
// Two tiers per metric, because these tools serve different jobs and *should*
// have different sensitivities — but from shared numbers, not arbitrary ones:
//   WATCH    — worth a look. The deep-dive diagnostic and the roll-up flag here.
//   CRITICAL — serious enough to surface as a client-facing signal.
//
// Budget and rank differ on purpose: a little lost-to-budget is a clean growth
// lever, whereas rank loss usually needs more headroom before it's worth acting.
//
// (Conversion-rate anomaly thresholds live in ./conversion-integrity and are
//  already shared by the diagnostic; QS ≤ 5 is consistent everywhere.)

export const LOST_BUDGET_WATCH = 10;
export const LOST_BUDGET_CRITICAL = 25;
export const LOST_RANK_WATCH = 20;
export const LOST_RANK_CRITICAL = 30;

// Absolute-top impression share below this (percent) = weak top-of-page presence.
export const ABS_TOP_LOW = 25;

type LostIsMetric = "budget" | "rank";

/** WATCH cutoff for the given metric (percent). */
export function lostIsWatch(metric: LostIsMetric): number {
  return metric === "budget" ? LOST_BUDGET_WATCH : LOST_RANK_WATCH;
}

/** CRITICAL cutoff for the given metric (percent). */
export function lostIsCritical(metric: LostIsMetric): number {
  return metric === "budget" ? LOST_BUDGET_CRITICAL : LOST_RANK_CRITICAL;
}
