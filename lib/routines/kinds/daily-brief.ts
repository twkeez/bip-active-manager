import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDailyBrief, saveDailyBrief } from "@/lib/daily-brief/load";
import { TIER_LABEL, type BriefTier } from "@/lib/daily-brief/types";
import type { RoutineFinding, RoutineResult } from "@/lib/routines/types";

/**
 * The Daily Brief routine: builds the brief, saves it for the day, and records
 * a short summary. The brief itself lives on /daily-brief; this run only says
 * what it found.
 *
 * No model is involved, so a run costs nothing and the same data gives the
 * same brief.
 */

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Tiers worth listing in the run record; "keep an eye on" and "quiet" stay on the page. */
const LISTED_TIERS: BriefTier[] = [1, 2, 3];

export async function runDailyBrief(
  admin: SupabaseClient,
  _settings: Record<string, unknown>,
  now: Date,
): Promise<RoutineResult> {
  const brief = await buildDailyBrief(admin, now);
  await saveDailyBrief(admin, brief);

  const findings: RoutineFinding[] = brief.clients
    .filter((client) => LISTED_TIERS.includes(client.tier))
    .map((client) => ({
      group: TIER_LABEL[client.tier],
      label: client.name,
      meta: client.reasons.join(" · "),
      href: "/daily-brief",
      flagged: client.tier === 2,
    }));

  for (const missed of brief.unchecked) {
    findings.push({ group: "Could not be checked", label: missed.name, meta: missed.reason, href: "/daily-brief", flagged: true });
  }

  const { counts } = brief;
  const parts = [
    counts[1] > 0 ? `${counts[1]} onboarding` : null,
    counts[2] > 0 ? `${counts[2]} chasing us` : null,
    counts[3] > 0 ? `${counts[3]} need action` : null,
    counts[4] > 0 ? `${counts[4]} to watch` : null,
    brief.unchecked.length > 0 ? `${brief.unchecked.length} could not be checked` : null,
  ].filter(Boolean);
  const stale =
    brief.staleSources.length > 0
      ? ` Data not yet in today: ${brief.staleSources.join(", ")}.`
      : brief.freshnessError
        ? " Could not confirm today's data had synced."
        : "";

  return {
    // Attention when someone is chasing us, something needs action, or a client could not be read.
    status: counts[2] > 0 || counts[3] > 0 || brief.unchecked.length > 0 ? "attention" : "ok",
    headline: `${plural(brief.clients.length, "client")} in today's brief${parts.length ? `: ${parts.join(", ")}` : ""}.${stale}`,
    findings,
  };
}
