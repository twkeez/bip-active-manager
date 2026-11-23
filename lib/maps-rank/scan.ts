import { DATAFORSEO_ENDPOINTS, extractTaskResult, postDataForSeoLive } from "@/lib/dataforseo/client";
import { getDataForSeoConfig } from "@/lib/env";
import type { GridPoint, MapsListing, MapsRankResults, MapsRankTrackerRow, SearchResult } from "@/lib/maps-rank/types";

export const GRID_SIZE = 5;
/** Results read at each point. Google Maps is asked for 20; a practice further down shows as "not in the top 20". */
export const DEPTH = 20;
/** Map zoom of every search: about a town's width. The same on every run, so runs compare. */
const ZOOM = "13z";
const CONCURRENCY = 6;
const FEATURE = "Maps rank tracker";
const MILES_PER_DEGREE_LAT = 69.0;

type Point = { latitude: number; longitude: number };
type MapsItem = {
  type?: string;
  rank_group?: number;
  title?: string;
  domain?: string | null;
  category?: string | null;
  place_id?: string | null;
  rating?: { value?: number | null; votes_count?: number | null } | null;
  latitude?: number | null;
  longitude?: number | null;
};
export type MapsSearch = (keyword: string, at: Point) => Promise<{ ok: boolean; error: string | null; cost: number; items: MapsItem[] }>;

export function milesBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(x));
}

/** A square of points around the practice, north row first, reaching `radiusMiles` in each direction. */
export function buildGrid(center: Point, radiusMiles: number, size = GRID_SIZE): Omit<GridPoint, "rank">[] {
  const step = (radiusMiles * 2) / (size - 1);
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((center.latitude * Math.PI) / 180);
  const points: Omit<GridPoint, "rank">[] = [];
  for (let row = 0; row < size; row += 1)
    for (let col = 0; col < size; col += 1)
      points.push({
        row,
        col,
        lat: center.latitude + (radiusMiles - row * step) / MILES_PER_DEGREE_LAT,
        lng: center.longitude + (-radiusMiles + col * step) / milesPerDegreeLng,
      });
  return points;
}

const bare = (domain: string | null | undefined) => (domain ?? "").toLowerCase().replace(/^www\./, "");

/** Google's own Maps results (ads dropped), with the practice's listing marked. */
export function toListings(items: MapsItem[], you: { placeId: string; domain: string | null } & Point): MapsListing[] {
  const organic = items.filter((i) => i.type === "maps_search" && i.title);
  // The practice's main listing is the one with its Place ID. Only when that isn't in the results does a
  // listing on the practice's website count (a doctor's own listing, say), and then only the first.
  const byPlace = organic.some((i) => i.place_id === you.placeId);
  const firstByDomain = byPlace || !you.domain ? null : (organic.find((i) => bare(i.domain) === bare(you.domain)) ?? null);
  return organic.map((i, index) => ({
    position: i.rank_group ?? index + 1,
    name: i.title as string,
    category: i.category ?? null,
    rating: typeof i.rating?.value === "number" ? i.rating.value : null,
    reviewCount: typeof i.rating?.votes_count === "number" ? i.rating.votes_count : null,
    miles: typeof i.latitude === "number" && typeof i.longitude === "number" ? Math.round(milesBetween(you, { latitude: i.latitude, longitude: i.longitude }) * 10) / 10 : null,
    isYou: byPlace ? i.place_id === you.placeId : i === firstByDomain,
  }));
}

/** What a report lists: the first ten, plus the practice's own listing when it sits further down. */
export const SHOWN = 10;
const shown = (listings: MapsListing[]) => listings.filter((l) => l.position <= SHOWN || l.isYou);

export const rankOf = (listings: MapsListing[]): number | null => listings.find((l) => l.isYou)?.position ?? null;

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

function dataForSeoSearch(): MapsSearch {
  const config = getDataForSeoConfig();
  if (!config) throw new Error("DataForSEO isn't configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).");
  return async (keyword, at) => {
    const response = await postDataForSeoLive(
      DATAFORSEO_ENDPOINTS.mapsAdvanced,
      config.login,
      config.password,
      [{ keyword, location_coordinate: `${at.latitude},${at.longitude},${ZOOM}`, language_code: "en", depth: DEPTH }],
      FEATURE,
    );
    const items = ((extractTaskResult(response.data) as { items?: MapsItem[] } | null)?.items ?? []) as MapsItem[];
    return { ok: response.ok, error: response.error, cost: response.cost, items };
  };
}

/**
 * Runs every tracked search from the town point and from each grid point (the
 * middle one is the practice's own address). A failed point is recorded as
 * failed, never as "not ranked".
 */
export async function runMapsRankScan(
  tracker: Pick<MapsRankTrackerRow, "place_id" | "domain" | "latitude" | "longitude" | "town_label" | "town_latitude" | "town_longitude" | "radius_miles" | "searches">,
  search: MapsSearch = dataForSeoSearch(),
): Promise<{ results: MapsRankResults; costUsd: number; status: "complete" | "partial" | "failed" }> {
  const you = { placeId: tracker.place_id, domain: tracker.domain, latitude: tracker.latitude, longitude: tracker.longitude };
  const grid = buildGrid(you, Number(tracker.radius_miles));
  const middle = (GRID_SIZE - 1) / 2;
  const town = { latitude: tracker.town_latitude, longitude: tracker.town_longitude };
  let cost = 0;
  let asked = 0;
  let failed = 0;
  const problems: string[] = [];
  const searches: SearchResult[] = [];

  for (const tracked of tracker.searches) {
    const look = async (at: Point) => {
      asked += 1;
      try {
        const got = await search(tracked.keyword, at);
        cost += got.cost;
        if (!got.ok) throw new Error(got.error ?? "Search failed.");
        return { listings: toListings(got.items, you), error: null as string | null };
      } catch (e) {
        failed += 1;
        return { listings: [] as MapsListing[], error: e instanceof Error ? e.message : "Search failed." };
      }
    };
    const fromTown = await look(town);
    const cells = await inBatches(grid, CONCURRENCY, async (cell) => ({ cell, got: await look({ latitude: cell.lat, longitude: cell.lng }) }));
    const atAddress = cells.find((c) => c.cell.row === middle && c.cell.col === middle)!.got;
    const failedCells = cells.filter((c) => c.got.error).length;
    if (fromTown.error) problems.push(`"${tracked.keyword}" from ${tracker.town_label} couldn't be read: ${fromTown.error}`);
    if (failedCells) problems.push(`"${tracked.keyword}": ${failedCells} of the ${grid.length} map points couldn't be read and show as blank.`);
    searches.push({
      keyword: tracked.keyword,
      goal: tracked.goal,
      town: { rank: rankOf(fromTown.listings), listings: shown(fromTown.listings), error: fromTown.error },
      address: { rank: rankOf(atAddress.listings), listings: shown(atAddress.listings), error: atAddress.error },
      grid: cells.map(({ cell, got }) => ({ ...cell, rank: rankOf(got.listings), ...(got.error ? { failed: true } : {}) })),
    });
  }

  return {
    results: { depth: DEPTH, radiusMiles: Number(tracker.radius_miles), gridSize: GRID_SIZE, searches, problems },
    costUsd: Number(cost.toFixed(4)),
    status: failed === 0 ? "complete" : failed === asked ? "failed" : "partial",
  };
}
