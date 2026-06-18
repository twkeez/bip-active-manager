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
    return NextResponse.json({ error: "Could not extract a business name from that URL — make sure it's a Google Maps place URL" }, { status: 422 });
  }

  // Strategy 1: Text search with tight location bias using coordinates from the URL
  if (lat !== null && lng !== null) {
    try {
      const query = encodeURIComponent(name);
      const bias = `circle:200@${lat},${lng}`;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&locationbias=${bias}&fields=place_id,name&key=${apiKey}`,
      );
      const data = await res.json() as { status: string; candidates?: Array<{ place_id?: string; name?: string }> };
      if (data.status === "OK" && data.candidates?.[0]?.place_id) {
        return NextResponse.json({ place_id: data.candidates[0].place_id, name: data.candidates[0].name, method: "text+coords" });
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: Text search without bias (just name)
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name&key=${apiKey}`,
    );
    const data = await res.json() as { status: string; candidates?: Array<{ place_id?: string; name?: string }> };
    if (data.status === "OK" && data.candidates?.[0]?.place_id) {
      return NextResponse.json({ place_id: data.candidates[0].place_id, name: data.candidates[0].name, method: "text" });
    }
    // Return the actual API status so we can see what went wrong
    return NextResponse.json(
      { error: `Places API returned: ${data.status} — check that the Places API is enabled for this key` },
      { status: 422 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Places API request failed" },
      { status: 500 },
    );
  }
}
