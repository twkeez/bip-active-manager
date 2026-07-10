import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDataForSeoConfig } from "@/lib/env";
import { resolvePracticeCenterFromPlaceId } from "@/lib/local-rank/places-center";
import { runOrganicRankScan } from "@/lib/organic-rank/scan";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getDataForSeoConfig();
  if (!config) {
    return NextResponse.json({ error: "DataForSEO credentials are not configured on the server." }, { status: 503 });
  }

  let body: { clientId?: number };
  try {
    body = (await request.json()) as { clientId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("website, google_place_id")
    .eq("id", clientId)
    .maybeSingle<Pick<ClientRow, "website" | "google_place_id">>();
  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.website?.trim()) {
    return NextResponse.json({ error: "Add the client's website URL in settings first." }, { status: 400 });
  }
  if (!client.google_place_id?.trim()) {
    return NextResponse.json({ error: "Add the Google Place ID in settings first." }, { status: 400 });
  }

  const { data: keywordRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .eq("is_active", true);
  const keywords = [...new Set((keywordRows ?? []).map((r) => r.keyword.trim()).filter(Boolean))];
  if (keywords.length === 0) {
    return NextResponse.json({ error: "Add at least one tracked keyword first." }, { status: 400 });
  }

  const center = await resolvePracticeCenterFromPlaceId(client.google_place_id.trim());
  if (!center) {
    return NextResponse.json({ error: "Could not resolve the practice location from the Google Place ID." }, { status: 422 });
  }

  let results;
  try {
    results = await runOrganicRankScan(config, {
      websiteUrl: client.website,
      keywords,
      lat: center.lat,
      lng: center.lng,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Organic rank scan failed." },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  const rows = results.map((r) => ({
    owner_user_id: user.id,
    client_id: clientId,
    keyword: r.keyword,
    position: r.position,
    url: r.url,
    top_domain: r.topDomain,
    checked_at: now,
  }));
  const { error: insertError } = await supabase.from("client_organic_rank_snapshots").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
