import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DiscoverResult = {
  ga4_id: string | null;
  google_place_id: string | null;
  sources: Record<string, string>;
};

function extractGa4Id(html: string): { value: string; source: string } | null {
  // gtag config: gtag('config', 'G-XXXXXXXX')
  const gtagMatch = html.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](\bG-[A-Z0-9]{4,12}\b)['"]/);
  if (gtagMatch?.[1]) return { value: gtagMatch[1], source: "gtag config" };

  // dataLayer push with measurement_id
  const dlMatch = html.match(/['"]measurement_id['"]\s*:\s*['"](\bG-[A-Z0-9]{4,12}\b)['"]/);
  if (dlMatch?.[1]) return { value: dlMatch[1], source: "dataLayer" };

  // Any G- pattern in script src (GTM container sometimes exposes it)
  const srcMatch = html.match(/['"](G-[A-Z0-9]{4,12})['"]/);
  if (srcMatch?.[1]) return { value: srcMatch[1], source: "script tag" };

  return null;
}

function extractPlaceId(html: string): { value: string; source: string } | null {
  // Maps embed iframe: place_id=ChIJ... or /place/ChIJ...
  const placeIdParam = html.match(/[?&]place_id=(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (placeIdParam?.[1]) return { value: placeIdParam[1], source: "Maps embed" };

  const placeInPath = html.match(/\/place\/(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (placeInPath?.[1]) return { value: placeInPath[1], source: "Maps embed URL" };

  // Google Maps URL with /maps?cid= (different ID format — skip, not a place ID)
  // JSON-LD sameAs pointing to google.com/maps/place/...
  const jsonLdPlace = html.match(/google\.com\/maps\/place\/[^/"]*\/(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (jsonLdPlace?.[1]) return { value: jsonLdPlace[1], source: "JSON-LD schema" };

  // GBP widget or review link
  const reviewLink = html.match(/maps\.google\.[a-z]+\/maps\?.*?cid=(\d{10,25})/);
  if (reviewLink?.[1]) return { value: reviewLink[1], source: "GBP review link (CID)" };

  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = Number(params.id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id,website,owner_user_id")
    .eq("id", clientId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!clientRow) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const website = (clientRow.website ?? "").trim();
  if (!website) {
    return NextResponse.json({ error: "No website URL set for this client" }, { status: 400 });
  }

  let url = website;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 BIP-Discovery-Bot/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Website returned ${res.status}` },
        { status: 422 },
      );
    }
    html = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch website" },
      { status: 422 },
    );
  }

  const ga4 = extractGa4Id(html);
  const placeId = extractPlaceId(html);

  const result: DiscoverResult = {
    ga4_id: ga4?.value ?? null,
    google_place_id: placeId?.value ?? null,
    sources: {
      ...(ga4 ? { ga4_id: ga4.source } : {}),
      ...(placeId ? { google_place_id: placeId.source } : {}),
    },
  };

  return NextResponse.json(result);
}
