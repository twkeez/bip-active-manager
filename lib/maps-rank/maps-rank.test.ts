import { describe, expect, it } from "vitest";
import { driveFolderId } from "@/lib/maps-rank/google-doc";
import { fitZoom, overlaySvg, tierOf, toPixel } from "@/lib/maps-rank/map-image";
import { buildReport } from "@/lib/maps-rank/report";
import { buildGrid, GRID_SIZE, milesBetween, runMapsRankScan, toListings, type MapsSearch } from "@/lib/maps-rank/scan";
import { parsePoint } from "@/lib/maps-rank/store";
import { rankChange, summarize } from "@/lib/maps-rank/summary";
import type { MapsRankRunRow } from "@/lib/maps-rank/types";

const practice = { latitude: 39.1167, longitude: -77.1659 };
const tracker = {
  practice_name: "Vet",
  place_id: "PLACE",
  domain: "vet.com",
  ...practice,
  town_label: "Town center",
  town_latitude: 39.084,
  town_longitude: -77.1528,
  radius_miles: 3,
  goal_date: "2027-02-05",
  searches: [{ keyword: "veterinarian Town", goal: 3 }],
};
const item = (rank: number, placeId: string, over: Record<string, unknown> = {}) => ({ type: "maps_search", rank_group: rank, title: `Business ${rank}`, place_id: placeId, domain: "other.com", latitude: 39.1, longitude: -77.1, rating: { value: 4.5, votes_count: 10 }, ...over });
/** The practice ranks `rank` from every point, in a list of 20. */
const ranked = (rank: number | null): MapsSearch => async () => ({ ok: true, error: null, cost: 0.002, items: Array.from({ length: 20 }, (_, i) => item(i + 1, i + 1 === rank ? "PLACE" : `P${i}`)) });

describe("the grid", () => {
  it("is 25 points, north row first, with the practice in the middle and the corners 3 miles out each way", () => {
    const grid = buildGrid(practice, 3);
    expect(grid).toHaveLength(GRID_SIZE * GRID_SIZE);
    const middle = grid.find((p) => p.row === 2 && p.col === 2)!;
    expect(middle.lat).toBeCloseTo(practice.latitude, 6);
    expect(middle.lng).toBeCloseTo(practice.longitude, 6);
    expect(grid[0].lat).toBeGreaterThan(grid[24].lat);
    expect(grid[0].lng).toBeLessThan(grid[24].lng);
    expect(milesBetween(practice, { latitude: grid[2].lat, longitude: grid[2].lng })).toBeCloseTo(3, 1);
    expect(milesBetween(practice, { latitude: grid[10].lat, longitude: grid[10].lng })).toBeCloseTo(3, 1);
  });
});

describe("finding the practice in the results", () => {
  const you = { placeId: "PLACE", domain: "vet.com", ...practice };
  it("leaves out ads and goes by the Place ID", () => {
    const listings = toListings([{ type: "maps_paid_item", title: "Ad" }, item(1, "A"), item(2, "PLACE")], you);
    expect(listings.map((l) => l.isYou)).toEqual([false, true]);
  });
  it("does not count a doctor's own listing when the main listing is there", () => {
    const listings = toListings([item(1, "PLACE"), item(2, "DOCTOR", { domain: "www.vet.com" })], you);
    expect(listings.filter((l) => l.isYou).map((l) => l.position)).toEqual([1]);
  });
  it("falls back to the first listing on the practice's website", () => {
    const listings = toListings([item(1, "A"), item(2, "B", { domain: "www.vet.com" }), item(3, "C", { domain: "vet.com" })], you);
    expect(listings.filter((l) => l.isYou).map((l) => l.position)).toEqual([2]);
  });
});

describe("a scan", () => {
  it("searches the town point and every grid point, and keeps the practice's row when it is below the tenth", async () => {
    let calls = 0;
    const search = ranked(13);
    const { results, costUsd, status } = await runMapsRankScan(tracker, async (k, at) => ((calls += 1), search(k, at)));
    expect(calls).toBe(26);
    expect(status).toBe("complete");
    expect(costUsd).toBeCloseTo(0.052, 3);
    const s = results.searches[0];
    expect(s.town.rank).toBe(13);
    expect(s.address.rank).toBe(13);
    expect(s.town.listings.map((l) => l.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13]);
    expect(s.grid.every((p) => p.rank === 13)).toBe(true);
  });
  it("marks a point it couldn't read as failed, not as unranked", async () => {
    let calls = 0;
    const good = ranked(null);
    const { results, status } = await runMapsRankScan(tracker, async (k, at) => {
      calls += 1;
      return calls === 5 ? { ok: false, error: "Timed out", cost: 0, items: [] } : good(k, at);
    });
    expect(status).toBe("partial");
    const s = results.searches[0];
    expect(s.grid.filter((p) => p.failed)).toHaveLength(1);
    expect(s.grid.filter((p) => !p.failed).every((p) => p.rank === null)).toBe(true);
    expect(results.problems[0]).toContain("1 of the 25 map points");
  });
  it("says failed when nothing could be read", async () => {
    const { status } = await runMapsRankScan(tracker, async () => {
      throw new Error("down");
    });
    expect(status).toBe("failed");
  });
});

const runAt = async (id: number, ranAt: string, rank: number | null): Promise<MapsRankRunRow> => ({ id, tracker_id: 1, ran_at: ranAt, status: "complete", results: (await runMapsRankScan(tracker, ranked(rank))).results, cost_usd: 0, error: null, doc_url: null });

describe("the comparison", () => {
  it("treats a lower number as better and unranked as worst", () => {
    expect(rankChange(5, 9)).toBe("better");
    expect(rankChange(null, 9)).toBe("worse");
    expect(rankChange(18, null)).toBe("better");
    expect(rankChange(4, 4)).toBe("same");
    expect(rankChange(4, undefined)).toBeNull();
  });
  it("uses the first run as the baseline and the run before as last time", async () => {
    const runs = [await runAt(1, "2026-11-09T12:00:00Z", 13), await runAt(2, "2026-11-23T12:00:00Z", 11), await runAt(3, "2026-12-07T12:00:00Z", 6)];
    const [row] = summarize(tracker, runs[2], runs);
    expect(row.baseline?.rank).toBe(13);
    expect(row.last?.rank).toBe(11);
    expect(row.sinceBaseline).toBe("better");
    expect(row.goalMet).toBe(false);
    const report = buildReport(tracker, runs[2], runs);
    expect(report.reportNumber).toBe(3);
    expect(report.summary[0].changeLabel).toBe("Up 7 places");
    expect(report.summary[0].todayLabel).toBe("#6");
  });
  it("prefers a baseline recorded on the tracker, and calls a first run a first report", async () => {
    const first = await runAt(1, "2026-11-23T12:00:00Z", 9);
    const baseline = buildReport(tracker, first, [first]);
    expect(baseline.isBaseline).toBe(true);
    expect(baseline.sections[0].headline).toBe("From Town center: #9. From your address: #9. Goal: top 3.");
    const withBaseline = { ...tracker, searches: [{ ...tracker.searches[0], baseline: { rank: 8, date: "2026-11-05" } }] };
    const report = buildReport(withBaseline, first, [first]);
    expect(report.isBaseline).toBe(false);
    expect(report.summary[0].baselineLabel).toBe("#8 (Nov 5)");
    expect(report.summary[0].changeLabel).toBe("Down 1 place");
  });
  it("says so when the practice isn't in the results read", async () => {
    const run = await runAt(1, "2026-11-23T12:00:00Z", null);
    const report = buildReport(tracker, run, [run]);
    expect(report.summary[0].todayLabel).toBe("Not in the top 20");
    expect(report.sections[0].gridLine).toContain("Within the top 3 at 0 of the 25 map points");
  });
});

describe("the map picture", () => {
  const center = { lat: practice.latitude, lng: practice.longitude };
  const grid = buildGrid(practice, 3).map((p, i) => ({ ...p, rank: i === 0 ? null : i }));
  it("fits every grid point inside the picture, with the practice in the middle", () => {
    const zoom = fitZoom(center, grid);
    expect(toPixel(center, zoom, center)).toEqual({ x: 640, y: 640 });
    for (const p of grid) {
      const { x, y } = toPixel(center, zoom, p);
      expect(x).toBeGreaterThan(100);
      expect(x).toBeLessThan(1180);
      expect(y).toBeGreaterThan(100);
      expect(y).toBeLessThan(1180);
    }
    // North is up, west is left.
    expect(toPixel(center, zoom, grid[0]).y).toBeLessThan(640);
    expect(toPixel(center, zoom, grid[0]).x).toBeLessThan(640);
  });
  it("colours by the goal", () => {
    expect(tierOf({ rank: 3 }, 3)).toBe("goal");
    expect(tierOf({ rank: 7 }, 3)).toBe("near");
    expect(tierOf({ rank: 14 }, 3)).toBe("far");
    expect(tierOf({ rank: null }, 3)).toBe("none");
    expect(tierOf({ rank: null, failed: true }, 3)).toBe("failed");
  });
  it("draws one circle per point", () => {
    const svg = overlaySvg({ center, zoom: fitZoom(center, grid), grid, goal: 5, depth: 20 });
    expect(svg.match(/<circle/g)).toHaveLength(25);
  });
});

describe("small inputs", () => {
  it("reads a Drive folder link or id", () => {
    expect(driveFolderId("https://drive.google.com/drive/folders/1CMG0FyPoUjs7VDd4O5ZNK_KwTU44U53C?usp=sharing")).toBe("1CMG0FyPoUjs7VDd4O5ZNK_KwTU44U53C");
    expect(driveFolderId("0AO0mq5j0yFzxUk9PVA")).toBe("0AO0mq5j0yFzxUk9PVA");
    expect(driveFolderId("")).toBeNull();
    expect(driveFolderId("not a link")).toBeNull();
  });
  it("reads coordinates as copied from Google Maps", () => {
    expect(parsePoint("39.0840, -77.1528")).toEqual({ latitude: 39.084, longitude: -77.1528 });
    expect(parsePoint("Rockville")).toBeNull();
    expect(parsePoint("139.1, -77")).toBeNull();
  });
});
