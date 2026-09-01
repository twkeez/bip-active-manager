import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import {
  buildCampaignPlanPrompt,
  campaignPlanOutputFormat,
  type CampaignPlan,
} from "@/lib/onboarding/campaign-plan";
import type { ClientRow } from "@/lib/types/client";
import { archiveResearchVersion } from "@/lib/onboarding/research-history";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Draft the PPC campaign plan: start from the Best Practices skeleton + negatives
// (our constants) and have AI fill the practice-specific variances.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client = clientRaw as ClientRow;

  const { data: intake } = await supabase
    .from("client_onboarding_intake")
    .select("pipeline_notes, competitor_ads")
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: trackedRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("client_id", clientId)
    .eq("is_active", true);
  const keywords = (trackedRows ?? []).map((r) => r.keyword as string).filter(Boolean);

  // Best Practices constants: the campaign skeleton + universal negatives.
  const { data: bpRows } = await supabase
    .from("best_practices")
    .select("key, content")
    .in("key", ["ppc_campaign_skeleton", "ppc_negatives"]);
  const bp = new Map((bpRows ?? []).map((r) => [r.key as string, (r.content as string | null) ?? ""]));
  const skeleton = bp.get("ppc_campaign_skeleton") ?? "";
  const constantNegatives = (bp.get("ppc_negatives") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const competitors = Array.isArray(intake?.competitor_ads)
    ? (intake!.competitor_ads as Array<{ name?: string; offers?: string }>).map((c) => ({
        name: String(c.name ?? ""),
        offers: String(c.offers ?? ""),
      }))
    : [];

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildCampaignPlanPrompt({
            practiceName: client.account_name,
            location: client.city ?? "",
            notes: (intake?.pipeline_notes as string | null) ?? "",
            keywords,
            competitors,
            skeleton,
          }),
        },
      ],
      output_config: { format: campaignPlanOutputFormat },
    });
    const parsed = message.parsed_output as
      | { adGroups?: CampaignPlan["adGroups"]; budgetNotes?: string; addedNegatives?: string[] }
      | null;

    const negatives = [
      ...new Set([...constantNegatives, ...(parsed?.addedNegatives ?? [])].map((n) => n.trim()).filter(Boolean)),
    ];
    const plan: CampaignPlan = {
      adGroups: parsed?.adGroups ?? [],
      budgetNotes: parsed?.budgetNotes ?? "",
      negatives,
    };

    const at = new Date().toISOString();
    await archiveResearchVersion(supabase, clientId, "campaign_plan", user.id);
    await supabase.from("client_onboarding_intake").upsert(
      { client_id: clientId, campaign_plan: plan, campaign_plan_at: at, updated_at: at },
      { onConflict: "client_id" },
    );
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign plan draft failed" },
      { status: 500 },
    );
  }
}
