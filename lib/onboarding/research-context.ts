import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientRow } from "@/lib/types/client";
import { loadOnboardingBackground } from "./background";
import { asPracticeType, competitorGuidance, practiceTypeForPrompt, type PracticeType } from "./practice-type";
import { describeLocation, locationInstruction, researchLocationFor, type ResearchLocation } from "./research-location";
import type { ResearchKind } from "./research-history";

/**
 * Everything both research calls (market research and competitor
 * advertising) need to know about where and what the client is, built in one
 * place so the two can't drift apart again: they did, and one researched
 * Parkville, Missouri for a Maryland client.
 */
export type ResearchContext = {
  location: ResearchLocation;
  /** "9512 Harford Rd, Parkville, MD 21234 (Baltimore County, Maryland, USA)". */
  locationLine: string;
  locationInstruction: string;
  practiceType: PracticeType | null;
  practiceTypeLine: string;
  competitorGuidance: string | null;
  background: string;
};

export async function loadResearchContext(
  supabase: SupabaseClient,
  client: ClientRow,
): Promise<{ ok: true; context: ResearchContext } | { ok: false; error: string }> {
  const { data: intake } = await supabase
    .from("client_onboarding_intake")
    .select("pipeline_raw")
    .eq("client_id", client.id)
    .maybeSingle();
  const pipelineLocation = ((intake?.pipeline_raw as Record<string, unknown> | null)?.location as string | undefined) ?? null;
  const located = researchLocationFor(client, pipelineLocation);
  if (!located.ok) return located;
  const practiceType = asPracticeType(client.practice_type);
  return {
    ok: true,
    context: {
      location: located.location,
      locationLine: describeLocation(located.location),
      locationInstruction: locationInstruction(located.location),
      practiceType,
      practiceTypeLine: practiceTypeForPrompt(practiceType),
      competitorGuidance: competitorGuidance(practiceType),
      background: await loadOnboardingBackground(supabase, client.id),
    },
  };
}

/**
 * Keep a research result that failed the location check, marked as rejected,
 * so nothing that cost an AI call is lost. The current research is untouched.
 */
export async function archiveRejectedResearch(
  supabase: SupabaseClient,
  clientId: number,
  kind: ResearchKind,
  result: unknown,
  reason: string,
  userId: string | null,
): Promise<void> {
  await supabase.from("client_research_history").insert({
    client_id: clientId,
    kind,
    payload: { rejected: true, reason, result },
    captured_at: new Date().toISOString(),
    archived_by: userId,
  });
}
