import {
  DATAFORSEO_ENDPOINTS,
  DEFAULT_LANGUAGE_CODE,
  extractTaskResult,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";
import { domainFromUrlOrHost } from "@/lib/dataforseo/domain-discovery";
import { SCAN_CONCURRENCY } from "@/lib/local-rank/constants";

type Credentials = { login: string; password: string };

export interface OrganicRankResult {
  keyword: string;
  position: number | null; // organic rank_group; null = not found in the top `depth`
  url: string | null;
  topDomain: string | null; // #1 organic result's domain, for competitor context
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

// Where the client's website ranks in the Google organic (blue-link) results for
// one keyword, checked at a coordinate. Reuses the same DataForSEO organic SERP
// endpoint the local-pack scan calls — here we read the `organic` items.
export async function fetchOrganicRank(
  creds: Credentials,
  keyword: string,
  coordinate: string, // "lat,lng" (no radius — organic doesn't need one)
  websiteDomain: string,
): Promise<Omit<OrganicRankResult, "keyword">> {
  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.serpOrganicAdvanced,
    creds.login,
    creds.password,
    [
      {
        keyword,
        location_coordinate: coordinate,
        language_code: DEFAULT_LANGUAGE_CODE,
        device: "desktop",
        os: "windows",
        depth: 100,
      },
    ],
  );
  if (!response.ok) {
    throw new Error(response.error ?? "Failed to fetch organic SERP.");
  }
  const result = extractTaskResult(response.data) as { items?: unknown[] } | null;
  const organic = ((result?.items ?? []).filter(
    (raw) => (raw as { type?: string }).type === "organic",
  ) as Array<{ rank_group?: number; rank_absolute?: number; domain?: string | null; url?: string | null }>);

  const topDomain = organic[0]?.domain ?? null;
  const match = websiteDomain
    ? organic.find(
        (it) =>
          domainFromUrlOrHost(it.domain) === websiteDomain ||
          domainFromUrlOrHost(it.url) === websiteDomain,
      )
    : undefined;

  return {
    position: match ? match.rank_group ?? match.rank_absolute ?? null : null,
    url: match?.url ?? null,
    topDomain,
  };
}

export async function runOrganicRankScan(
  creds: Credentials,
  input: { websiteUrl: string | null; keywords: string[]; lat: number; lng: number },
): Promise<OrganicRankResult[]> {
  const coordinate = `${input.lat},${input.lng}`;
  const websiteDomain = domainFromUrlOrHost(input.websiteUrl);
  return mapWithConcurrency(input.keywords, SCAN_CONCURRENCY, async (keyword) => {
    const r = await fetchOrganicRank(creds, keyword, coordinate, websiteDomain);
    return { keyword, ...r };
  });
}
