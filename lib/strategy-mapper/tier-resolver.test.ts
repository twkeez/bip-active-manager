import { describe, expect, it } from "vitest";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import {
  getUpsellTierCandidates,
  resolveSelectedTiers,
  resolveTierKeyFromLabel,
} from "@/lib/strategy-mapper/tier-resolver";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const tiers = DEFAULT_TIER_FALLBACKS;

const baseForm: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo", "orm"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
};

describe("resolveTierKeyFromLabel", () => {
  it("maps SEO Local to seo-foundation", () => {
    expect(resolveTierKeyFromLabel("SEO Local", "seo", tiers)).toBe("seo-foundation");
  });

  it("maps SEO Premium Plus to seo-premium-plus", () => {
    expect(resolveTierKeyFromLabel("SEO Premium Plus", "seo", tiers)).toBe(
      "seo-premium-plus",
    );
  });

  it("maps ORM Premium Plus to orm-premium", () => {
    expect(resolveTierKeyFromLabel("ORM Premium Plus", "orm", tiers)).toBe("orm-premium");
  });

  it("maps Google Ads to ppc-premium", () => {
    expect(resolveTierKeyFromLabel("Google Ads", "ppc", tiers)).toBe("ppc-premium");
  });

  it("maps Social Media to social-standard", () => {
    expect(resolveTierKeyFromLabel("Social Media", "social", tiers)).toBe(
      "social-standard",
    );
  });
});

describe("resolveSelectedTiers", () => {
  it("resolves tiers from purchased product labels", () => {
    const form: StrategyMapperFormData = {
      ...baseForm,
      salesPdfExtract: {
        summary: "Test",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo", "orm"],
        purchasedProductLabels: ["SEO Local", "ORM Premium Plus"],
        clinicalDifferentiator: "",
        primaryProcedures: [],
        clientRunsOwnAds: false,
        adsPerformanceNote: "",
        vendorPlatforms: [],
        ormProgramName: "ORM Premium Plus",
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
    };

    const selected = resolveSelectedTiers(form, ["seo", "orm"], tiers);
    expect(selected.seo).toBe("seo-foundation");
    expect(selected.orm).toBe("orm-premium");
  });

  it("respects tierOverrides", () => {
    const form: StrategyMapperFormData = {
      ...baseForm,
      tierOverrides: { seo: "seo-premium-plus" },
      salesPdfExtract: {
        summary: "Test",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo"],
        purchasedProductLabels: ["SEO Local"],
        clinicalDifferentiator: "",
        primaryProcedures: [],
        clientRunsOwnAds: false,
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
    };

    const selected = resolveSelectedTiers(form, ["seo"], tiers);
    expect(selected.seo).toBe("seo-premium-plus");
  });
});

describe("getUpsellTierCandidates", () => {
  it("offers entry tier for unselected service", () => {
    const candidates = getUpsellTierCandidates(
      { seo: "seo-premium" },
      ["seo"],
      tiers,
      [{ service: "ppc", framing: "introduction" }],
    );
    expect(candidates.some((c) => c.tierKey === "ppc-premium")).toBe(true);
  });

  it("offers higher tier for selected service upsell", () => {
    const candidates = getUpsellTierCandidates(
      { seo: "seo-premium" },
      ["seo"],
      tiers,
      [{ service: "seo", framing: "introduction" }],
    );
    expect(candidates.some((c) => c.tierKey === "seo-premium-plus")).toBe(true);
    expect(candidates.some((c) => c.tierKey === "seo-foundation")).toBe(false);
  });
});
