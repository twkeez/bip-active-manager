import { fetchLocalPackAtCoordinate } from "@/lib/local-rank/scan";
import { findPracticeRankInLocalPack } from "@/lib/local-rank/match";
import { SCAN_CONCURRENCY } from "@/lib/local-rank/constants";
import type { RankGridCell } from "@/lib/local-rank/types";

type Credentials = { login: string; password: string };

const MILES_TO_KM = 1.60934;

export interface ResolvedZone {
  zoneId: number;
  label: string;
  lat: number;
  lng: number;
  /** Local-pack search radius in miles (widens how far Google looks). */
  radiusMiles: number;
}

export interface ZoneKeywordResult {
  keyword: string;
  rank: number | null;
  inLocalPack: boolean;
  // Whether Google returned a local pack at all for this term. Branded searches
  // (e.g. the practice's own name) produce a knowledge panel and no pack, which
  // is different from a pack existing that we're absent from.
  hasPack: boolean;
}

export interface ZoneScanResult {
  zoneId: number;
  results: ZoneKeywordResult[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

// Runs a single-point local-pack rank check for each zone × keyword, reusing
// the same DataForSEO primitives as the heat-map grid scan.
export async function runZoneScan(
  creds: Credentials,
  input: {
    businessName: string;
    websiteUrl?: string | null;
    keywords: string[];
    zones: ResolvedZone[];
  },
): Promise<ZoneScanResult[]> {
  const tasks = input.zones.flatMap((zone) =>
    input.keywords.map((keyword) => ({ zone, keyword })),
  );

  const flat = await mapWithConcurrency(tasks, SCAN_CONCURRENCY, async ({ zone, keyword }) => {
    const cell: RankGridCell = {
      row: 0,
      col: 0,
      lat: zone.lat,
      lng: zone.lng,
      label: zone.label,
    };
    const searchRadiusKm = Math.max(1, zone.radiusMiles * MILES_TO_KM);
    const listings = await fetchLocalPackAtCoordinate(creds, keyword, cell, searchRadiusKm);
    const match = findPracticeRankInLocalPack({
      businessName: input.businessName,
      websiteUrl: input.websiteUrl,
      listings,
    });
    return {
      zoneId: zone.zoneId,
      result: {
        keyword,
        rank: match.rank,
        inLocalPack: match.inLocalPack,
        hasPack: listings.length > 0,
      } satisfies ZoneKeywordResult,
    };
  });

  const byZone = new Map<number, ZoneKeywordResult[]>();
  for (const zone of input.zones) byZone.set(zone.zoneId, []);
  for (const { zoneId, result } of flat) {
    byZone.get(zoneId)!.push(result);
  }
  return input.zones.map((zone) => ({ zoneId: zone.zoneId, results: byZone.get(zone.zoneId) ?? [] }));
}
