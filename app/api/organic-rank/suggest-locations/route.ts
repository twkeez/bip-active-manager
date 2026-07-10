import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePracticeCenterFromPlaceId } from "@/lib/local-rank/places-center";
import { suggestLocations } from "@/lib/organic-rank/geocode";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Suggested ZIPs (practice + nearby) seeded from the practice address.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseClientId(new URL(request.url).searchParams.get("clientId"));
  if (!clientId) return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });

  const { data: client } = await supabase
    .from("clients")
    .select("google_place_id")
    .eq("id", clientId)
    .maybeSingle<Pick<ClientRow, "google_place_id">>();
  if (!client?.google_place_id?.trim()) {
    return NextResponse.json({ zips: [] });
  }

  const center = await resolvePracticeCenterFromPlaceId(client.google_place_id.trim());
  if (!center) return NextResponse.json({ zips: [] });

  const zips = await suggestLocations({ lat: center.lat, lng: center.lng });
  return NextResponse.json({ zips });
}
