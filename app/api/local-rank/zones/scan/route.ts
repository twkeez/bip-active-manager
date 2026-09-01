import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDataForSeoConfig } from "@/lib/env";
import { geocodeZip } from "@/lib/local-rank/geocode-zip";
import { resolvePracticeCenterFromPlaceId } from "@/lib/local-rank/places-center";
import { runZoneScan, type ResolvedZone } from "@/lib/local-rank/zone-scan";
import { LOCAL_PACK_SEARCH_RADIUS_KM } from "@/lib/local-rank/constants";
import type { ClientRankZoneRow } from "@/lib/local-rank/types";

const MILES_TO_KM = 1.60934;
// Radius (miles) that reproduces the default local-pack search radius, used for
// ZIP zones which don't carry their own radius.
const ZIP_ZONE_RADIUS_MILES = LOCAL_PACK_SEARCH_RADIUS_KM / MILES_TO_KM;

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
    return NextResponse.json(
      { error: "DataForSEO credentials are not configured on the server." },
      { status: 503 },
    );
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
    .select("account_name, website, google_place_id")
    .eq("id", clientId)
    .maybeSingle<{ account_name: string; website: string | null; google_place_id: string | null }>();
  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: keywordRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("client_id", clientId)
    .eq("is_active", true);
  const keywords = [...new Set((keywordRows ?? []).map((r) => r.keyword.trim()).filter(Boolean))];
  if (keywords.length === 0) {
    return NextResponse.json({ error: "Add at least one tracked keyword first." }, { status: 400 });
  }

  const { data: zoneRows, error: zonesError } = await supabase
    .from("client_rank_zones")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (zonesError) return NextResponse.json({ error: zonesError.message }, { status: 500 });
  const zones = (zoneRows ?? []) as ClientRankZoneRow[];
  if (zones.length === 0) {
    return NextResponse.json({ error: "Add at least one zone first." }, { status: 400 });
  }

  // Resolve each zone to coordinates: ZIP → geocode; radius → practice center.
  let practiceCenter: { lat: number; lng: number } | null = null;
  if (zones.some((z) => z.kind === "radius")) {
    practiceCenter = client.google_place_id
      ? await resolvePracticeCenterFromPlaceId(client.google_place_id.trim())
      : null;
  }

  const resolved: ResolvedZone[] = [];
  const unresolved: number[] = [];
  for (const zone of zones) {
    if (zone.kind === "zip" && zone.zip) {
      const coord = await geocodeZip(zone.zip);
      if (coord) {
        resolved.push({ zoneId: zone.id, label: zone.label, lat: coord.lat, lng: coord.lng, radiusMiles: ZIP_ZONE_RADIUS_MILES });
        continue;
      }
    } else if (zone.kind === "radius" && practiceCenter) {
      resolved.push({
        zoneId: zone.id,
        label: zone.label,
        lat: practiceCenter.lat,
        lng: practiceCenter.lng,
        radiusMiles: zone.radius_miles ?? 5,
      });
      continue;
    }
    unresolved.push(zone.id);
  }

  if (resolved.length === 0) {
    return NextResponse.json(
      { error: "No zones could be resolved. Check the ZIP codes and that the client has a Google Place ID." },
      { status: 422 },
    );
  }

  let scanResults;
  try {
    scanResults = await runZoneScan(config, {
      businessName: client.account_name,
      websiteUrl: client.website,
      keywords,
      zones: resolved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Zone scan failed." },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  for (const zoneResult of scanResults) {
    await supabase
      .from("client_rank_zones")
      .update({ last_results: zoneResult.results, last_scanned_at: now })
      .eq("id", zoneResult.zoneId)
      .eq("owner_user_id", user.id);
  }

  const { data: refreshed } = await supabase
    .from("client_rank_zones")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ zones: refreshed ?? [], unresolved });
}
