import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDataForSeoConfig } from "@/lib/env";
import { fetchCompetitorAds } from "@/lib/dataforseo/competitor-ads";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Look up who is advertising for the practice's keywords in its city.
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

  const config = getDataForSeoConfig();
  if (!config) {
    return NextResponse.json({ error: "DataForSEO credentials are not configured." }, { status: 503 });
  }

  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client = clientRaw as ClientRow;

  const { data: trackedRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .eq("is_active", true);
  const tracked = (trackedRows ?? []).map((r) => r.keyword as string).filter(Boolean);

  const city = (client.city ?? "").split(",")[0].trim();
  const keywords = tracked.length
    ? tracked
    : ["vet near me", city && `emergency vet ${city}`, city && `animal hospital ${city}`].filter(
        (k): k is string => Boolean(k),
      );

  try {
    const competitorAds = await fetchCompetitorAds(config, keywords, client.city);
    const at = new Date().toISOString();
    await supabase.from("client_onboarding_intake").upsert(
      { client_id: clientId, competitor_ads: competitorAds, competitor_ads_at: at, updated_at: at },
      { onConflict: "client_id" },
    );
    return NextResponse.json({ ok: true, competitorAds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Competitor ad lookup failed" },
      { status: 500 },
    );
  }
}
