import { describe, expect, it } from "vitest";
import { isPracticeLabel, monthStart, planMonthlyScan, type RankClient } from "./monthly";

const client = (id: number, over: Partial<RankClient> = {}): RankClient => ({
  id,
  account_name: `Client ${id}`,
  website: "https://example.com",
  google_place_id: "place",
  ...over,
});

describe("monthStart", () => {
  it("is midnight UTC on the 1st", () => {
    expect(monthStart(new Date("2026-12-01T07:05:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(monthStart(new Date("2026-11-30T23:59:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("isPracticeLabel", () => {
  it("counts the practice and rows from before locations", () => {
    expect(isPracticeLabel("Practice")).toBe(true);
    expect(isPracticeLabel(null)).toBe(true);
    expect(isPracticeLabel("15108")).toBe(false);
  });
});

describe("planMonthlyScan", () => {
  it("skips clients with no keywords and ones already scanned this month", () => {
    const plan = planMonthlyScan({
      clients: [client(1), client(2), client(3)],
      keywordsByClient: new Map([
        [2, ["vet near me"]],
        [3, ["vet near me", "emergency vet"]],
      ]),
      scannedThisMonth: new Set([2]),
    });
    expect(plan.due.map((c) => c.id)).toEqual([3]);
    expect(plan.alreadyDone).toBe(1);
    expect(plan.missingSetup).toEqual([]);
  });

  it("names clients that can't be scanned instead of skipping them silently", () => {
    const plan = planMonthlyScan({
      clients: [client(1, { website: null }), client(2, { google_place_id: " " })],
      keywordsByClient: new Map([
        [1, ["a"]],
        [2, ["b"]],
      ]),
      scannedThisMonth: new Set(),
    });
    expect(plan.due).toEqual([]);
    expect(plan.missingSetup).toEqual(["Client 1: no website", "Client 2: no Google Place ID"]);
  });

  it("puts clients with fewer keywords first", () => {
    const plan = planMonthlyScan({
      clients: [client(1), client(2)],
      keywordsByClient: new Map([
        [1, ["a", "b", "c"]],
        [2, ["a"]],
      ]),
      scannedThisMonth: new Set(),
    });
    expect(plan.due.map((c) => c.id)).toEqual([2, 1]);
  });
});
