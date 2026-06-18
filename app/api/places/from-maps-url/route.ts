import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseMapsUrl(input: string): { name: string | null; lat: number | null; lng: number | null } {
  let name: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const url = new URL(input);

    // Business name from /maps/place/<name>/...
    const pathMatch = url.pathname.match(/\/place\/([^/@]+)/);
    if (pathMatch?.[1]) {
      name = decodeURIComponent(pathMatch[1].replace(/\+/g, " "));
    }

    // Coordinates from @lat,lng in path
    const coordMatch = (url.pathname + url.search).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }
  } catch {
    // invalid URL
  }

  return { name, lat, lng };
}

type PlacesV1Response = {
  places?: Array<{ id?: string; displayName?: { text?: string } }>;
  error?: { message?: string; status?: string };
};

async function searchPlacesV1(
  query: string,
  lat: number | null,
  lng: number | null,
  apiKey: string,
): Promise<{ place_id: string; name: string } | null> {
  const body: Record<string, unknown> = { textQuery: query, pageSize: 1 };
  if (lat !== null && lng !== null) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 200.0,
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as PlacesV1Response;

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Places API error: ${res.status}`);
  }

  const place = data.places?.[0];
  if (place?.id) {
    return { place_id: place.id, name: place.displayName?.text ?? query };
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No Maps API key configured" }, { status: 500 });

  const body = await request.json().catch(() => ({})) as { mapsUrl?: string };
  const mapsUrl = (body.mapsUrl ?? "").trim();
  if (!mapsUrl) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  const { name, lat, lng } = parseMapsUrl(mapsUrl);

  if (!name) {
    return NextResponse.json(
      { error: "Could not extract a business name from that URL — make sure it's a Google Maps place URL" },
      { status: 422 },
    );
  }

  try {
    // Try with coordinates first (tight location bias), then without
    const result = await searchPlacesV1(name, lat, lng, apiKey)
      ?? await searchPlacesV1(name, null, null, apiKey);

    if (result) {
      return NextResponse.json({ place_id: result.place_id, name: result.name, method: "places-v1" });
    }
    return NextResponse.json({ error: "No matching place found" }, { status: 422 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Places API request failed" },
      { status: 500 },
    );
  }
}
