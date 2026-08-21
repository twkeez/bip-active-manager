import { describe, expect, it } from "vitest";
import { loadClientBackground } from "@/lib/dashboard/load-client-background";

/** Minimal stand-in for the one query the loader makes. */
function supabaseReturning(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row }) }),
      }),
    }),
  } as never;
}

describe("loadClientBackground", () => {
  it("returns null when the client never went through onboarding", async () => {
    expect(await loadClientBackground(supabaseReturning(null), 1)).toBeNull();
  });

  // Most clients with a row only got partway — a row is not research.
  it("returns null when the intake row has no research in it", async () => {
    const row = {
      discovery: { competitors: [], marketSnapshot: "  ", searchLandscape: null },
      discovery_at: "2026-06-01T00:00:00Z",
      competitor_ads: [],
      competitor_ads_at: null,
    };
    expect(await loadClientBackground(supabaseReturning(row), 1)).toBeNull();
  });

  it("reads competitors, market and landscape with their capture date", async () => {
    const row = {
      discovery: {
        competitors: [{ name: "Banfield", note: "National chain, price-led" }],
        marketSnapshot: "Suburban, two other practices within 5mi.",
        searchLandscape: "Low competition on branded terms.",
      },
      discovery_at: "2026-06-01T00:00:00Z",
      competitor_ads: null,
      competitor_ads_at: null,
    };
    const result = await loadClientBackground(supabaseReturning(row), 1);
    expect(result?.competitors).toEqual([
      { name: "Banfield", note: "National chain, price-led" },
    ]);
    expect(result?.marketSnapshot).toBe("Suburban, two other practices within 5mi.");
    expect(result?.searchLandscape).toBe("Low competition on branded terms.");
    expect(result?.discoveryAt).toBe("2026-06-01T00:00:00Z");
    expect(result?.competitorAds).toEqual([]);
  });

  it("keeps competitor ad rows and how we counter them", async () => {
    const row = {
      discovery: null,
      discovery_at: null,
      competitor_ads: [
        {
          name: "VCA",
          offers: "Free first exam",
          positioning: "Convenience",
          counter: "Lead on continuity of care",
        },
      ],
      competitor_ads_at: "2026-06-02T00:00:00Z",
    };
    const result = await loadClientBackground(supabaseReturning(row), 1);
    expect(result?.competitorAds).toHaveLength(1);
    expect(result?.competitorAds[0].counter).toBe("Lead on continuity of care");
    expect(result?.competitorAdsAt).toBe("2026-06-02T00:00:00Z");
  });

  it("drops blank entries rather than rendering empty rows", async () => {
    const row = {
      discovery: {
        competitors: [{ name: "  ", note: "" }, { name: "Real Vet", note: "" }],
      },
      discovery_at: null,
      competitor_ads: [{ name: "", offers: "", positioning: "", counter: "" }],
      competitor_ads_at: null,
    };
    const result = await loadClientBackground(supabaseReturning(row), 1);
    expect(result?.competitors).toEqual([{ name: "Real Vet", note: "" }]);
    expect(result?.competitorAds).toEqual([]);
  });

  it("survives malformed json rather than throwing at the client", async () => {
    const row = {
      discovery: { competitors: [{ name: 42, note: null }], marketSnapshot: 7 },
      discovery_at: null,
      competitor_ads: null,
      competitor_ads_at: null,
    };
    expect(await loadClientBackground(supabaseReturning(row), 1)).toBeNull();
  });
});
