import {
  DATAFORSEO_ENDPOINTS,
  extractTaskResult,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";

export type CompetitorAd = { advertiser: string; title: string; description: string };

function toLocationName(city: string | null | undefined): string | null {
  const raw = (city ?? "").trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(",");
}

// Pull the Google Ads (paid) results advertising for the practice's keywords in
// its city — a real competitive-ad snapshot. Dedupes by advertiser domain.
export async function fetchCompetitorAds(
  config: { login: string; password: string },
  keywords: string[],
  city: string | null | undefined,
): Promise<CompetitorAd[]> {
  const locationName = toLocationName(city);
  if (!locationName || keywords.length === 0) return [];

  const byAdvertiser = new Map<string, CompetitorAd>();
  for (const keyword of keywords.slice(0, 4)) {
    try {
      const res = await postDataForSeoLive(
        DATAFORSEO_ENDPOINTS.serpOrganicAdvanced,
        config.login,
        config.password,
        [{ keyword, location_name: locationName, language_code: "en", depth: 20 }],
      );
      if (!res.ok) continue;
      const result = extractTaskResult(res.data) as { items?: Array<Record<string, unknown>> } | null;
      const paid = (result?.items ?? []).filter((it) => it?.type === "paid");
      for (const ad of paid) {
        const advertiser = String(ad.domain ?? "").trim().toLowerCase();
        if (!advertiser || byAdvertiser.has(advertiser)) continue;
        byAdvertiser.set(advertiser, {
          advertiser,
          title: String(ad.title ?? "").trim(),
          description: String(ad.description ?? "").trim(),
        });
      }
    } catch {
      // skip this keyword, keep what we have
    }
  }
  return [...byAdvertiser.values()];
}
