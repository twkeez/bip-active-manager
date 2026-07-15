import { postDataForSeoLive } from "@/lib/dataforseo/client";

const SEARCH_VOLUME_URL =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";

// DataForSEO wants location_name as "City,Region,Country" (no spaces after
// commas). Strict city targeting per the SEO workflow — sparse results are a
// signal to widen the target area, not an error.
function toLocationName(city: string | null | undefined): string | null {
  const raw = (city ?? "").trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(",");
}

// Monthly Google search volume per keyword, localized to the practice city.
// Returns a lower-cased keyword → volume map; volumes are null when unknown or
// the location could not be resolved (the call degrades gracefully).
export async function fetchSearchVolumes(
  config: { login: string; password: string },
  keywords: string[],
  city: string | null | undefined,
): Promise<Record<string, number | null>> {
  const map: Record<string, number | null> = {};
  for (const k of keywords) map[k.toLowerCase()] = null;
  const locationName = toLocationName(city);
  if (keywords.length === 0 || !locationName) return map;

  try {
    const res = await postDataForSeoLive(SEARCH_VOLUME_URL, config.login, config.password, [
      { keywords, location_name: locationName, language_code: "en" },
    ]);
    if (!res.ok) return map;
    const result =
      ((res.data as { tasks?: Array<{ result?: Array<{ keyword?: string; search_volume?: number | null }> }> })
        .tasks?.[0]?.result) ?? [];
    for (const item of result) {
      if (item?.keyword) {
        map[String(item.keyword).toLowerCase()] =
          typeof item.search_volume === "number" ? item.search_volume : null;
      }
    }
  } catch {
    // graceful — keep null volumes
  }
  return map;
}
