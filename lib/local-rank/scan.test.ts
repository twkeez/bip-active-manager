import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPracticeRankInLocalPack } from "@/lib/local-rank/match";
import { runLocalRankGridScan } from "@/lib/local-rank/scan";

const postDataForSeoLive = vi.fn();

vi.mock("@/lib/dataforseo/client", () => ({
  DATAFORSEO_ENDPOINTS: { localPackAdvanced: "/local_pack/advanced/live" },
  DEFAULT_LANGUAGE_CODE: "en",
  extractTaskResult: (data: unknown) => (data as { tasks?: Array<{ result?: unknown[] }> })?.tasks?.[0]?.result?.[0] ?? null,
  postDataForSeoLive: (...args: unknown[]) => postDataForSeoLive(...args),
}));

function mockLocalPackResponse(listings: Array<{ rank: number; title: string; domain?: string | null }>) {
  postDataForSeoLive.mockResolvedValueOnce({
    ok: true,
    data: {
      tasks: [
        {
          result: [
            {
              items: listings.map((listing) => ({
                type: "local_pack",
                rank_absolute: listing.rank,
                title: listing.title,
                domain: listing.domain ?? null,
              })),
            },
          ],
        },
      ],
    },
  });
}

describe("findPracticeRankInLocalPack", () => {
  it("matches practice by business name", () => {
    const result = findPracticeRankInLocalPack({
      businessName: "All Critters Veterinary Hospital",
      websiteUrl: "https://allcrittersvet.com",
      listings: [
        { rank: 1, title: "Competitor Vet", domain: "competitor.com" },
        { rank: 2, title: "All Critters Vet - Granite Bay", domain: "allcrittersvet.com" },
      ],
    });

    expect(result.rank).toBe(2);
    expect(result.inLocalPack).toBe(true);
    expect(result.topCompetitor?.title).toBe("Competitor Vet");
  });

  it("returns null rank when practice is not in pack", () => {
    const result = findPracticeRankInLocalPack({
      businessName: "Missing Practice",
      listings: [{ rank: 1, title: "Other Clinic", domain: "other.com" }],
    });

    expect(result.rank).toBeNull();
    expect(result.inLocalPack).toBe(false);
  });
});

describe("runLocalRankGridScan", () => {
  beforeEach(() => {
    postDataForSeoLive.mockReset();
  });

  it("runs one API call per grid cell per keyword with manual center", async () => {
    for (let index = 0; index < 25; index += 1) {
      mockLocalPackResponse([
        { rank: 1, title: "Competitor Vet", domain: "competitor.com" },
        { rank: 2, title: "Granite Bay Animal Hospital", domain: "granitebayvet.com" },
      ]);
    }

    const result = await runLocalRankGridScan(
      { login: "user", password: "pass" },
      {
        businessName: "Granite Bay Animal Hospital",
        websiteUrl: "https://granitebayvet.com",
        keywords: ["veterinarian near me"],
        manualCenter: { lat: 38.7521, lng: -121.288, source: "manual" },
      },
    );

    expect(result.apiCallsCompleted).toBe(25);
    expect(postDataForSeoLive).toHaveBeenCalledTimes(25);
    expect(result.cells.every((cell) => cell.rank === 2)).toBe(true);
    expect(result.cells.every((cell) => cell.inLocalPack)).toBe(true);
  });

  it("caps at 75 calls for 3 keywords", async () => {
    for (let index = 0; index < 75; index += 1) {
      mockLocalPackResponse([{ rank: 1, title: "Only Listing", domain: "only.com" }]);
    }

    const result = await runLocalRankGridScan(
      { login: "user", password: "pass" },
      {
        businessName: "Only Listing",
        keywords: ["one", "two", "three"],
        manualCenter: { lat: 38.7521, lng: -121.288, source: "manual" },
      },
    );

    expect(result.apiCallsCompleted).toBe(75);
    expect(postDataForSeoLive).toHaveBeenCalledTimes(75);
  });
});
