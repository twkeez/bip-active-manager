import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import {
  buildCompetitorOffersPrompt,
  competitorOffersOutputFormat,
  type CompetitorOffer,
} from "@/lib/onboarding/competitor-offers";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Research what competitors are promoting/advertising (AI + web search) — the
// SERP scrape doesn't surface local vet ads, so we research offers instead.
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
    .select("pipeline_notes")
    .eq("client_id", clientId)
    .maybeSingle();

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: buildCompetitorOffersPrompt(
            client.account_name,
            client.city ?? "",
            (intake?.pipeline_notes as string | null) ?? "",
          ),
        },
      ],
      output_config: { format: competitorOffersOutputFormat },
    });
    const parsed = message.parsed_output as { competitors?: CompetitorOffer[] } | null;
    const competitors = parsed?.competitors ?? [];

    const at = new Date().toISOString();
    await supabase.from("client_onboarding_intake").upsert(
      { client_id: clientId, competitor_ads: competitors, competitor_ads_at: at, updated_at: at },
      { onConflict: "client_id" },
    );
    return NextResponse.json({ ok: true, competitors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Competitor research failed" },
      { status: 500 },
    );
  }
}
