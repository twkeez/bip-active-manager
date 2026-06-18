import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DiscoverResult = {
  ga4_id: string | null;
  google_place_id: string | null;
  sources: Record<string, string>;
};

function extractGa4Id(html: string): { value: string; source: string } | null {
  // Direct gtag config: gtag('config', 'G-XXXXXXXX')
  const gtagMatch = html.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](\bG-[A-Z0-9]{4,12}\b)['"]/);
  if (gtagMatch?.[1]) return { value: gtagMatch[1], source: "gtag config" };

  // dataLayer push with measurement_id
  const dlMatch = html.match(/['"]measurement_id['"]\s*:\s*['"](\bG-[A-Z0-9]{4,12}\b)['"]/);
  if (dlMatch?.[1]) return { value: dlMatch[1], source: "dataLayer" };

  // Any G- pattern anywhere in page
  const srcMatch = html.match(/['"](G-[A-Z0-9]{4,12})['"]/);
  if (srcMatch?.[1]) return { value: srcMatch[1], source: "script tag" };

  return null;
}

function extractGtmId(html: string): string | null {
  const m = html.match(/['"](GTM-[A-Z0-9]{4,10})['"]/);
  return m?.[1] ?? null;
}

async function extractGa4IdFromGtm(gtmId: string): Promise<{ value: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${gtmId}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 BIP-Discovery-Bot/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const js = await res.text();
    const m = js.match(/['"](G-[A-Z0-9]{4,12})['"]/);
    if (m?.[1]) return { value: m[1], source: `GTM container (${gtmId})` };
  } catch {
    // ignore — GTM fetch failure is non-fatal
  }
  return null;
}

function extractPlaceId(html: string): { value: string; source: string } | null {
  // Maps embed: place_id=ChIJ...
  const placeIdParam = html.match(/[?&]place_id=(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (placeIdParam?.[1]) return { value: placeIdParam[1], source: "Maps embed" };

  // /place/Name/ChIJ...
  const placeInPath = html.match(/\/place\/[^/"]*\/(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (placeInPath?.[1]) return { value: placeInPath[1], source: "Maps URL" };

  // JSON-LD sameAs
  const jsonLdPlace = html.match(/google\.com\/maps\/place\/[^/"]*\/(ChIJ[A-Za-z0-9_-]{10,50})/);
  if (jsonLdPlace?.[1]) return { value: jsonLdPlace[1], source: "JSON-LD schema" };

  return null;
}

function extractMapsCid(html: string): string | null {
  // Maps embed pb= param contains !1s0x<low>:<high> — the hex CID
  // Convert the low hex part to a decimal CID for Places API lookup
  const m = html.match(/!1s(0x[0-9a-f]+)(?:%3A|:)(0x[0-9a-f]+)/i);
  if (!m?.[1]) return null;
  try {
    return BigInt(m[1]).toString(10);
  } catch {
    return null;
  }
}

async function lookupPlaceIdByCid(cid: string): Promise<{ value: string; source: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?cid=${cid}&fields=place_id,name&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as { status: string; result?: { place_id?: string; name?: string } };
    if (data.status === "OK" && data.result?.place_id) {
      return { value: data.result.place_id, source: "Maps embed (CID lookup)" };
    }
  } catch {
    // ignore
  }
  return null;
}

function extractMapsShortlinks(html: string): string[] {
  const links: string[] = [];
  const re = /https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/([A-Za-z0-9_-]{6,30})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0]) links.push(m[0]);
  }
  return [...new Set(links)].slice(0, 3);
}

async function resolvePlaceIdFromShortlink(url: string): Promise<{ value: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 BIP-Discovery-Bot/1.0" },
    });
    clearTimeout(timeout);
    const resolved = res.url;
    // /place/Name/ChIJ... in the final URL
    const m = resolved.match(/\/place\/[^/"]*\/(ChIJ[A-Za-z0-9_-]{10,50})/);
    if (m?.[1]) return { value: m[1], source: `Maps shortlink (${url.slice(0, 40)})` };
    // Also scan the response body for ChIJ patterns
    const body = await res.text();
    const bm = body.match(/"(ChIJ[A-Za-z0-9_-]{10,50})"/);
    if (bm?.[1]) return { value: bm[1], source: `Maps shortlink body` };
  } catch {
    // ignore — shortlink resolution failure is non-fatal
  }
  return null;
}

function extractBusinessInfo(html: string): { name: string | null; city: string | null; state: string | null } {
  let name: string | null = null;
  let city: string | null = null;
  let state: string | null = null;

  // JSON-LD: name, addressLocality, addressRegion
  const jsonLdBlock = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdBlock?.[1]) {
    const block = jsonLdBlock[1];
    const nameMatch = block.match(/"name"\s*:\s*"([^"]{3,100})"/);
    if (nameMatch?.[1]) name = nameMatch[1];
    const cityMatch = block.match(/"addressLocality"\s*:\s*"([^"]{2,60})"/);
    if (cityMatch?.[1]) city = cityMatch[1];
    const stateMatch = block.match(/"addressRegion"\s*:\s*"([^"]{2,10})"/);
    if (stateMatch?.[1]) state = stateMatch[1];
  }

  // og:site_name fallback
  if (!name) {
    const ogMatch = html.match(/property=["']og:site_name["'][^>]*content=["']([^"']{3,80})["']/);
    if (ogMatch?.[1]) name = ogMatch[1];
  }
  if (!name) {
    const ogMatch2 = html.match(/content=["']([^"']{3,80})["'][^>]*property=["']og:site_name["']/);
    if (ogMatch2?.[1]) name = ogMatch2[1];
  }

  // <title> fallback
  if (!name) {
    const titleMatch = html.match(/<title[^>]*>([^<]{3,80})<\/title>/i);
    if (titleMatch?.[1]) name = titleMatch[1].split(/[|\-–]/)[0].trim();
  }

  return { name, city, state };
}

async function lookupPlaceId(name: string, city: string | null, state: string | null, websiteUrl: string): Promise<{ value: string; source: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
    // Include city/state in the query so Vercel's IP doesn't bias to the wrong location
    const queryParts = [name, city, state].filter(Boolean);
    const query = encodeURIComponent(queryParts.join(", "));
    const fields = "place_id,name";
    const apiUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=${fields}&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as { status: string; candidates?: Array<{ place_id?: string; name?: string }> };
    if (data.status === "OK" && data.candidates?.[0]?.place_id) {
      return { value: data.candidates[0].place_id, source: `Places API (${domain})` };
    }
  } catch {
    // ignore — Places API failure is non-fatal
  }
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
    .select("id,website")
    .eq("id", clientId)
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

  let ga4 = extractGa4Id(html);
  let placeId = extractPlaceId(html);

  // If GA4 not found directly, try fetching the GTM container
  if (!ga4) {
    const gtmId = extractGtmId(html);
    if (gtmId) {
      ga4 = await extractGa4IdFromGtm(gtmId);
    }
  }

  // Try CID from Maps embed → Places API details lookup
  if (!placeId) {
    const cid = extractMapsCid(html);
    if (cid) {
      placeId = await lookupPlaceIdByCid(cid);
    }
  }

  // Try following Maps short links
  if (!placeId) {
    const shortlinks = extractMapsShortlinks(html);
    for (const link of shortlinks) {
      placeId = await resolvePlaceIdFromShortlink(link);
      if (placeId) break;
    }
  }

  // Last resort: Places API text search using business name + city/state from schema
  if (!placeId) {
    const { name, city, state } = extractBusinessInfo(html);
    if (name) {
      placeId = await lookupPlaceId(name, city, state, url);
    }
  }

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
