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
import { archiveRejectedResearch, loadResearchContext } from "@/lib/onboarding/research-context";
import { checkResearchLocation, locationProblemMessage } from "@/lib/onboarding/research-location";
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

  // Full address with the state spelled out, the kind of practice, and the
  // onboarding background (pipeline notes, kickoff doc, Basecamp). Refused
  // without a state: "Parkville" alone got Remedy Missouri research.
  const prepared = await loadResearchContext(supabase, client);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: 400 });
  const researchContext = prepared.context;
  const notes = researchContext.background;

  const data: ClientFormData = {
    practiceName: client.account_name,
    contactName: client.contact_name ?? "",
    location: researchContext.locationLine,
    practiceType: researchContext.practiceTypeLine,
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
      messages: [
        {
          role: "user",
          content: buildResearchPrompt(data, {
            locationInstruction: researchContext.locationInstruction,
            competitorGuidance: researchContext.competitorGuidance,
            background: notes,
          }),
        },
      ],
      output_config: { format: localResearchOutputFormat },
    });
    const research = researchMessage.parsed_output as LocalResearch | null;
    if (!research) throw new Error("Discovery returned no structured output");

    // About the right place? Research naming another state and never the
    // client's own is refused: the previous research stays, and the rejected
    // result is kept in history, marked rejected.
    const problems = checkResearchLocation(
      [
        { where: "the market snapshot", text: research.marketSnapshot },
        { where: "the search landscape", text: research.searchLandscape },
        ...(research.competitors ?? []).map((competitor, index) => ({
          where: `competitor ${index + 1} (${competitor.name})`,
          text: `${competitor.name}. ${competitor.note ?? ""}`,
        })),
      ],
      researchContext.location,
    );
    if (problems.length) {
      const message = locationProblemMessage(problems, researchContext.location);
      await archiveRejectedResearch(supabase, clientId, "discovery", research, message, user.id);
      return NextResponse.json({ error: message, locationProblems: problems }, { status: 422 });
    }

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
