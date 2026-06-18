import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ParsedMapsUrl = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  cid: string | null; // decimal string
};

function parseMapsUrl(input: string): ParsedMapsUrl {
  let name: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let cid: string | null = null;

  try {
    const url = new URL(input);

    // Business name from path: /maps/place/<name>/...
    const pathMatch = url.pathname.match(/\/place\/([^/]+)/);
    if (pathMatch?.[1]) {
      name = decodeURIComponent(pathMatch[1].replace(/\+/g, " "));
    }

    // Coordinates from @lat,lng in path
    const coordMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }

    // CID from !1s0x<low>:<high> in the data param
    const dataStr = decodeURIComponent(url.pathname + url.search);
    const cidMatch = dataStr.match(/!1s(0x[0-9a-f]+)(?::)(0x[0-9a-f]+)/i);
    if (cidMatch?.[1]) {
      cid = BigInt(cidMatch[1]).toString(10);
    }
  } catch {
    // ignore parse errors
  }

  return { name, lat, lng, cid };
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

  const { name, lat, lng, cid } = parseMapsUrl(mapsUrl);

  // Strategy 1: CID lookup via Places Details API
  if (cid) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?cid=${cid}&fields=place_id,name&key=${apiKey}`,
      );
      const data = await res.json() as { status: string; result?: { place_id?: string; name?: string } };
      if (data.status === "OK" && data.result?.place_id) {
        return NextResponse.json({ place_id: data.result.place_id, name: data.result.name, method: "cid" });
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: Find Place from Text with tight location bias
  if (name && lat !== null && lng !== null) {
    try {
      const query = encodeURIComponent(name);
      const bias = `circle:300@${lat},${lng}`;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&locationbias=${bias}&fields=place_id,name&key=${apiKey}`,
      );
      const data = await res.json() as { status: string; candidates?: Array<{ place_id?: string; name?: string }> };
      if (data.status === "OK" && data.candidates?.[0]?.place_id) {
        return NextResponse.json({ place_id: data.candidates[0].place_id, name: data.candidates[0].name, method: "text+coords" });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ error: "Could not resolve a Place ID from that URL" }, { status: 422 });
}
