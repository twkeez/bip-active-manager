import {
  DATAFORSEO_ENDPOINTS,
  DEFAULT_LANGUAGE_CODE,
  extractTaskResult,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";
import {
  LOCAL_PACK_SEARCH_RADIUS_KM,
  SCAN_CONCURRENCY,
} from "@/lib/local-rank/constants";
import { buildRankGrid } from "@/lib/local-rank/grid";
import { findPracticeRankInLocalPack } from "@/lib/local-rank/match";
import { resolvePracticeCenterFromPlaceId } from "@/lib/local-rank/places-center";
import type {
  GridCellScanResult,
  LocalPackListing,
  PracticeCenter,
  RankGridCell,
} from "@/lib/local-rank/types";
import { normalizeGridSize, normalizeKeywords, normalizeRadiusMiles } from "@/lib/local-rank/validate";

type Credentials = { login: string; password: string };

export interface LocalRankScanInput {
  businessName: string;
  websiteUrl?: string | null;
  googlePlaceId?: string | null;
  keywords: string[];
  radiusMiles?: number;
  gridSize?: number;
  manualCenter?: PracticeCenter | null;
}

export interface LocalRankScanResult {
  center: PracticeCenter;
  radiusMiles: number;
  gridSize: number;
  keywords: string[];
  grid: RankGridCell[];
  cells: GridCellScanResult[];
  apiCallsCompleted: number;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    runWorker(),
  );
  await Promise.all(workers);
  return results;
}

function parseLocalPackListings(apiData: unknown): LocalPackListing[] {
  const result = extractTaskResult(apiData) as { items?: unknown[] } | null;
  const packItems = (result?.items ?? []).filter(
    (raw) => (raw as { type?: string }).type === "local_pack",
  );

  const listings: LocalPackListing[] = [];
  for (const raw of packItems) {
    const item = raw as {
      rank_group?: number;
      rank_absolute?: number;
      title?: string;
      domain?: string | null;
    };
    listings.push({
      // rank_group is the position within the local pack (1/2/3); fall back to
      // rank_absolute, then to insertion order.
      rank: item.rank_group ?? item.rank_absolute ?? listings.length + 1,
      title: item.title ?? "Unknown listing",
      domain: item.domain ?? null,
    });
  }

  return listings.sort((left, right) => left.rank - right.rank);
}

export async function fetchLocalPackAtCoordinate(
  creds: Credentials,
  keyword: string,
  cell: RankGridCell,
  searchRadiusKm: number = LOCAL_PACK_SEARCH_RADIUS_KM,
): Promise<LocalPackListing[]> {
  const locationCoordinate = `${cell.lat},${cell.lng},${searchRadiusKm}`;
  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.localPackAdvanced,
    creds.login,
    creds.password,
    [
      {
        keyword,
        location_coordinate: locationCoordinate,
        language_code: DEFAULT_LANGUAGE_CODE,
        device: "desktop",
        os: "windows",
        depth: 20,
      },
    ],
  );

  if (!response.ok) {
    throw new Error(response.error ?? "Failed to load local pack rankings.");
  }

  return parseLocalPackListings(response.data);
}

export async function resolvePracticeCenter(input: {
  googlePlaceId?: string | null;
  manualCenter?: PracticeCenter | null;
}): Promise<PracticeCenter> {
  if (input.manualCenter) {
    return input.manualCenter;
  }

  if (input.googlePlaceId?.trim()) {
    const fromPlace = await resolvePracticeCenterFromPlaceId(input.googlePlaceId.trim());
    if (fromPlace) return fromPlace;
  }

  throw new Error(
    "Practice center could not be resolved. Add a Google Place ID on the client record (requires GOOGLE_MAPS_API_KEY), or provide manual coordinates.",
  );
}

export async function runLocalRankGridScan(
  creds: Credentials,
  input: LocalRankScanInput,
): Promise<LocalRankScanResult> {
  const keywords = normalizeKeywords(input.keywords);
  const radiusMiles = normalizeRadiusMiles(input.radiusMiles);
  const gridSize = normalizeGridSize(input.gridSize ?? 5);
  const center = await resolvePracticeCenter({
    googlePlaceId: input.googlePlaceId,
    manualCenter: input.manualCenter ?? null,
  });
  const grid = buildRankGrid(center, radiusMiles, gridSize);

  const tasks = keywords.flatMap((keyword) =>
    grid.map((cell) => ({ keyword, cell })),
  );

  const cells = await mapWithConcurrency(tasks, SCAN_CONCURRENCY, async ({ keyword, cell }) => {
    const listings = await fetchLocalPackAtCoordinate(creds, keyword, cell);
    const match = findPracticeRankInLocalPack({
      businessName: input.businessName,
      websiteUrl: input.websiteUrl,
      listings,
    });

    return {
      keyword,
      cell,
      rank: match.rank,
      inLocalPack: match.inLocalPack,
      matchedListingTitle: match.matchedListing?.title ?? null,
      matchedListingDomain: match.matchedListing?.domain ?? null,
      topCompetitorTitle: match.topCompetitor?.title ?? null,
    } satisfies GridCellScanResult;
  });

  return {
    center,
    radiusMiles,
    gridSize,
    keywords,
    grid,
    cells,
    apiCallsCompleted: tasks.length,
  };
}
