import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import { getClientServiceTierDefs } from "@/lib/playbook/client-tiers";
import { getClientActiveServices } from "@/lib/clients/service-active";
import {
  assembleKickoffBody,
  kickoffThreadTitle,
  quarterLabel,
  type KickoffBlock,
} from "@/lib/clients/onboarding-kickoff";
import type { ClientRow } from "@/lib/types/client";
import type { ConnectionsHealth } from "@/lib/clients/types";

export type OnboardingReportIntake = {
  form_type: string | null;
  contract_signed: boolean | null;
  web_status: string | null;
  website_launch_date: string | null;
  kickoff_meeting_at: string | null;
  service_start_plan: Record<string, { tier?: string; startTrigger?: string; startDate?: string | null }> | null;
  channels_present: Record<string, boolean> | null;
  pipeline_notes: string | null;
  discovery: {
    competitors?: Array<{ name: string; note: string }>;
    marketSnapshot?: string;
    searchLandscape?: string;
  } | null;
  competitor_ads: Array<{ name: string; offers: string; positioning: string; counter: string }> | null;
  campaign_plan: {
    adGroups?: Array<{ name: string; keywords: string[] }>;
    budgetNotes?: string;
    negatives?: string[];
  } | null;
  brand_elements: { logoUrl: string | null; heroImage: string | null; themeColor: string | null; title: string | null } | null;
};

export type OnboardingReportModel = {
  client: ClientRow;
  serviceTiers: ReturnType<typeof getClientServiceTierDefs>;
  intake: OnboardingReportIntake | null;
  keywords: string[];
  connectionsHealth: ConnectionsHealth;
  /** The ready-to-send Basecamp kickoff message (strategist's saved edit if any, else the live default). */
  kickoff: { title: string; body: string; isOverride: boolean };
};

export async function loadOnboardingReport(
  supabase: SupabaseClient,
  userId: string,
  clientId: number,
): Promise<OnboardingReportModel | null> {
  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return null;
  const client = clientRaw as ClientRow;

  const { data: intake } = await supabase
    .from("client_onboarding_intake")
    .select(
      "form_type, contract_signed, web_status, website_launch_date, kickoff_meeting_at, service_start_plan, channels_present, pipeline_notes, discovery, competitor_ads, campaign_plan, brand_elements",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: kwRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const [evaluation] = await buildOnboardingEvaluations(supabase, userId, [client]);

  // The ready-to-send Basecamp kickoff message, assembled the same way the
  // kickoff panel does: the strategist's saved edit if one exists, else the
  // live default built from the master template + active services.
  const { data: kickoffBlocks } = await supabase
    .from("onboarding_kickoff_blocks")
    .select("block_key, body, sort_order")
    .order("sort_order", { ascending: true });
  const defaultKickoffTitle = kickoffThreadTitle();
  const defaultKickoffBody = assembleKickoffBody((kickoffBlocks ?? []) as KickoffBlock[], {
    clientName: client.account_name,
    strategist: client.marketing_strategist?.trim() || "your strategist",
    quarterLabel: quarterLabel(),
    activeServices: getClientActiveServices(client),
  });
  const { data: kickoffOverride } = await supabase
    .from("client_onboarding_kickoff")
    .select("custom_title, custom_body")
    .eq("client_id", clientId)
    .maybeSingle<{ custom_title: string | null; custom_body: string | null }>();
  const kickoffIsOverride = Boolean(kickoffOverride?.custom_body);

  return {
    client,
    serviceTiers: getClientServiceTierDefs(client),
    intake: (intake as OnboardingReportIntake | null) ?? null,
    keywords: (kwRows ?? []).map((r) => r.keyword as string),
    connectionsHealth: evaluation.connectionsHealth,
    kickoff: {
      title: kickoffOverride?.custom_title || defaultKickoffTitle,
      body: kickoffIsOverride ? kickoffOverride!.custom_body! : defaultKickoffBody,
      isOverride: kickoffIsOverride,
    },
  };
}
