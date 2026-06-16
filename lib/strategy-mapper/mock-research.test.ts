import { describe, expect, it } from "vitest";
import {
  buildMockStrategyMapperResearch,
  isAnthropicUnavailableError,
  shouldUseMockStrategyMapperResearch,
} from "@/lib/strategy-mapper/mock-research";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const baseForm: StrategyMapperFormData = {
  practiceName: "Test Vet",
  practiceOwnerName: "",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "Suburban Monmouth County",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  siteContext: "existing_active",
  strategicContextNotes: "",
};

describe("buildMockStrategyMapperResearch", () => {
  it("returns valid research with placeholder competitors", () => {
    const result = buildMockStrategyMapperResearch(baseForm);

    expect(result.activeServices).toEqual(["seo"]);
    expect(result.research.competitors.length).toBeGreaterThanOrEqual(2);
    expect(result.research.clientMetrics.googleRating).toBe(4.0);
    expect(result.research.clientMetrics.reviewCount).toBe(50);
    expect(result.research.densityTier).toBeTruthy();
    expect(result.research.radiusRationale.trim().length).toBeGreaterThan(0);
  });

  it("aligns radius fields with calculateDualRadius", () => {
    const result = buildMockStrategyMapperResearch(baseForm);
    const radius = calculateDualRadius(baseForm);

    expect(result.radius).toEqual(radius);
    expect(result.research.densityTier).toBe(radius.densityTier);
    expect(result.research.wellnessRadiusMiles).toBe(radius.wellnessRadiusMiles);
    expect(result.research.specialtyRadiusEnabled).toBe(radius.specialtyRadiusEnabled);
    expect(result.research.radiusRationale).toBe(radius.rationale);
  });

  it("applies client rating and review count overrides from the form", () => {
    const result = buildMockStrategyMapperResearch({
      ...baseForm,
      clientGoogleRating: "4.6",
      clientReviewCount: "203",
      salesPdfExtract: {
        summary: "",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: [],
        purchasedProductLabels: [],
        clinicalDifferentiator: "",
        primaryProcedures: [],
        clientRunsOwnAds: true,
        adsPerformanceNote: "",
        vendorPlatforms: [],
        ormProgramName: "",
        socialContentThemes: [],
        primarySocialPlatform: "",
        socialAdsHistory: "",
        operationalBottlenecks: [],
        capacityNotes: "",
        vendorFrustrations: [],
        staffConstraints: "",
        doctorCount: "",
        clientPersonaTone: "standard",
      },
    });

    expect(result.research.clientMetrics.googleRating).toBe(4.6);
    expect(result.research.clientMetrics.reviewCount).toBe(203);
    expect(result.research.clientMetrics.runsGoogleAds).toBe(true);
  });

  it("throws when no active services are selected", () => {
    expect(() =>
      buildMockStrategyMapperResearch({ ...baseForm, activeServices: [] }),
    ).toThrow(/No active Phase 1 services/);
  });
});

describe("shouldUseMockStrategyMapperResearch", () => {
  it("honors explicit UI request", () => {
    expect(shouldUseMockStrategyMapperResearch(true)).toBe(true);
    expect(shouldUseMockStrategyMapperResearch(false)).toBe(false);
  });
});

describe("isAnthropicUnavailableError", () => {
  it("detects low-credit Anthropic failures", () => {
    expect(
      isAnthropicUnavailableError(
        new Error(
          '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
        ),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isAnthropicUnavailableError(new Error("Network timeout"))).toBe(false);
  });
});
