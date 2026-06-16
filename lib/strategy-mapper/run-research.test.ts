import { describe, expect, it } from "vitest";
import { calculateDualRadius, dualRadiusFromResearch } from "@/lib/strategy-mapper/radius";
import type { StrategyMapperResearch } from "@/types/strategy-mapper";

const baseResearch: StrategyMapperResearch = {
  densityTier: "suburban",
  wellnessRadiusMiles: 5,
  specialtyRadiusMiles: 40,
  specialtyRadiusEnabled: true,
  radiusRationale: "Suburban default with specialty radius for TPLO.",
  clientMetrics: { googleRating: 4.1, reviewCount: 85, runsGoogleAds: true },
  competitors: [],
};

describe("dualRadiusFromResearch", () => {
  it("maps research fields to DualRadiusResult with specialty label", () => {
    const radius = dualRadiusFromResearch(baseResearch);
    expect(radius.densityTier).toBe("suburban");
    expect(radius.wellnessRadiusMiles).toBe(5);
    expect(radius.specialtyRadiusMiles).toBe(40);
    expect(radius.specialtyRadiusEnabled).toBe(true);
    expect(radius.geographicFocusLabel).toBe(
      "5-Mile Local Core & 40-Mile Regional Surgical Grid",
    );
    expect(radius.rationale).toBe(baseResearch.radiusRationale);
  });

  it("uses local-core label when specialty radius is disabled", () => {
    const radius = dualRadiusFromResearch({
      ...baseResearch,
      specialtyRadiusEnabled: false,
      specialtyRadiusMiles: null,
    });
    expect(radius.geographicFocusLabel).toBe("5-Mile Local Core");
  });

  it("normalizes invalid wellness radius miles from density tier", () => {
    const radius = dualRadiusFromResearch({
      ...baseResearch,
      wellnessRadiusMiles: 7,
      densityTier: "urban",
    });
    expect(radius.wellnessRadiusMiles).toBe(3);
    expect(radius.geographicFocusLabel).toBe(
      "3-Mile Local Core & 40-Mile Regional Surgical Grid",
    );
  });

  it("round-trips calculateDualRadius rationale through research", () => {
    const form = {
      practiceName: "Test Vet",
      practiceOwnerName: "",
      streetAddress: "123 Main St, Howell, NJ",
      locationNotes: "Suburban Monmouth County",
      specializations: ["Orthopedic Surgery"],
      customSpecialization: "",
      activeServices: ["seo"] as const,
      primaryGoal: "General new client acquisition / Market dominance" as const,
      strategicContextNotes: "",
    };
    const computed = calculateDualRadius(form);
    const fromResearch = dualRadiusFromResearch({
      densityTier: computed.densityTier,
      wellnessRadiusMiles: computed.wellnessRadiusMiles,
      specialtyRadiusMiles: computed.specialtyRadiusMiles,
      specialtyRadiusEnabled: computed.specialtyRadiusEnabled,
      radiusRationale: computed.rationale,
      clientMetrics: { googleRating: 4, reviewCount: 10, runsGoogleAds: false },
      competitors: [],
    });
    expect(fromResearch.geographicFocusLabel).toBe(computed.geographicFocusLabel);
    expect(fromResearch.rationale).toBe(computed.rationale);
  });
});
