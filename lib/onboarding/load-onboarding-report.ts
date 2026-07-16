import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import { getClientServiceTierDefs } from "@/lib/playbook/client-tiers";
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
    .eq("owner_user_id", userId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const [evaluation] = await buildOnboardingEvaluations(supabase, userId, [client]);

  return {
    client,
    serviceTiers: getClientServiceTierDefs(client),
    intake: (intake as OnboardingReportIntake | null) ?? null,
    keywords: (kwRows ?? []).map((r) => r.keyword as string),
    connectionsHealth: evaluation.connectionsHealth,
  };
}
