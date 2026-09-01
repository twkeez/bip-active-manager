import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { buildResearchPrompt } from "@/lib/prompt";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import { localResearchOutputFormat } from "@/lib/vet-onboarding/research-json-schema";
import { activeServiceLabels, getClientActiveServices } from "@/lib/clients/service-active";
import type { ClientRow } from "@/lib/types/client";
import { archiveResearchVersion } from "@/lib/onboarding/research-history";
import type { ClientFormData, LocalResearch } from "@/types/onboarding";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Run the AI local-market discovery for the strategist's meeting prep:
// competitors, market snapshot, and search landscape (web-searched). Saves the
// result on the intake so it isn't re-run every visit.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Each run is a Claude call with web search enabled, so it costs real money
  // per press. Strategists read the research; they don't commission it.
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const { data: clientRaw, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!clientRaw) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client = clientRaw as ClientRow;

  const { data: intake } = await supabase
    .from("client_onboarding_intake")
    .select("pipeline_notes")
    .eq("client_id", clientId)
    .maybeSingle();
  const notes = (intake?.pipeline_notes as string | null) ?? "";

  const data: ClientFormData = {
    practiceName: client.account_name,
    contactName: client.contact_name ?? "",
    location: client.city ?? "",
    practiceType: "veterinary practice",
    numVets: "",
    services: activeServiceLabels(getClientActiveServices(client)),
    mainGoal: "",
    challenge: "",
    budget: "",
    timeline: "",
    presence: "",
    notes,
    websiteUrl: client.website ?? "",
    googleBusinessProfileUrls: "",
    facebookUrl: "",
    instagramUrl: "",
    otherSocialUrls: "",
    practicePhone: "",
    onlineBookingUrl: "",
    serviceAreaNotes: "",
    marketingManagedBy: "",
    previousAgencyName: "",
    intakeGoals: [],
    intakeSummary: notes,
  };

  try {
    const anthropic = new Anthropic({ apiKey });
    const researchMessage = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: buildResearchPrompt(data) }],
      output_config: { format: localResearchOutputFormat },
    });
    const research = researchMessage.parsed_output as LocalResearch | null;
    if (!research) throw new Error("Discovery returned no structured output");

    const discoveryAt = new Date().toISOString();
    await archiveResearchVersion(supabase, clientId, "discovery", user.id);
    await supabase.from("client_onboarding_intake").upsert(
      {
        client_id: clientId,
        discovery: research,
        discovery_at: discoveryAt,
        updated_at: discoveryAt,
      },
      { onConflict: "client_id" },
    );

    return NextResponse.json({ ok: true, discovery: research, discoveryAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 500 },
    );
  }
}
