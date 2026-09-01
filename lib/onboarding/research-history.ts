import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Archive the version of a research result that is about to be overwritten.
 *
 * The research tools upsert onto `client_onboarding_intake`, which is
 * `unique (client_id)` — so a re-run replaces the previous market snapshot,
 * competitor work, campaign plan or brand pull for everyone, permanently. Each
 * of those cost an AI call and is read by the whole team; a stray "Re-run"
 * should not be able to destroy one.
 *
 * Call this immediately before the upsert. The intake row stays the current
 * version so every existing reader is untouched.
 */

export type ResearchKind =
  | "discovery"
  | "competitor_ads"
  | "campaign_plan"
  | "brand_elements";

/** The `*_at` column paired with each payload column on the intake row. */
const CAPTURED_AT_COLUMN: Record<ResearchKind, string> = {
  discovery: "discovery_at",
  competitor_ads: "competitor_ads_at",
  campaign_plan: "campaign_plan_at",
  brand_elements: "brand_elements_at",
};

export async function archiveResearchVersion(
  supabase: SupabaseClient,
  clientId: number,
  kind: ResearchKind,
  archivedBy: string | null,
): Promise<void> {
  const atColumn = CAPTURED_AT_COLUMN[kind];

  const { data: current } = await supabase
    .from("client_onboarding_intake")
    .select(`${kind}, ${atColumn}`)
    .eq("client_id", clientId)
    .maybeSingle<Record<string, unknown>>();

  const payload = current?.[kind] ?? null;
  // Nothing to preserve on a first run, and an empty array or object is not
  // worth a row either.
  if (payload == null) return;
  if (Array.isArray(payload) && payload.length === 0) return;

  const capturedAt = (current?.[atColumn] as string | null) ?? null;

  // Deliberately not surfaced as an error: failing to archive must never stop a
  // strategist getting their new research. Losing a history row is a smaller
  // problem than a tool that refuses to run.
  await supabase.from("client_research_history").insert({
    client_id: clientId,
    kind,
    payload,
    captured_at: capturedAt,
    archived_by: archivedBy,
  });
}
