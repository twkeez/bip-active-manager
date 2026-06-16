import { describe, expect, it } from "vitest";
import {
  assembleActiveStrategies,
  assembleCompetitiveAuditRows,
  assembleGrowthOpportunityStubs,
  assembleStrategistChecklist,
  finalizeActiveStrategies,
  mergeDeterministicReport,
} from "@/lib/strategy-mapper/assemble-report";
import { PPC_INTRODUCTION_UPSELL_OBSERVATION } from "@/lib/strategy-mapper/ppc-tactic-resolver";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import type { StrategyMapperFormData, StrategyMapperResearch } from "@/types/strategy-mapper";

const form: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
};

const radius = calculateDualRadius(form);
const ctx = { form, radius };
const tiers = DEFAULT_TIER_FALLBACKS;

const research: StrategyMapperResearch = {
  densityTier: "suburban",
  wellnessRadiusMiles: 5,
  specialtyRadiusMiles: null,
  specialtyRadiusEnabled: false,
  radiusRationale: "Suburban default",
  clientMetrics: { googleRating: 4.1, reviewCount: 85, runsGoogleAds: false },
  competitors: [
    {
      name: "Red Bank Veterinary Hospital",
      distanceMiles: 5.2,
      googleRating: 4.5,
      reviewCount: 412,
      runsGoogleAds: true,
      scope: "local",
    },
    {
      name: "New Practice",
      distanceMiles: 2.1,
      googleRating: 4.0,
      reviewCount: 0,
      runsGoogleAds: false,
      scope: "local",
    },
  ],
};

describe("assembleCompetitiveAuditRows", () => {
  it("maps client and competitors 1:1 from verified research", () => {
    const rows = assembleCompetitiveAuditRows(form, research, ["seo"]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      practiceName: "Bayside Animal Hospital",
      isClient: true,
      distance: "—",
      googleRating: "4.1",
      reviewCount: "85",
      runsGoogleAds: "No",
    });
    expect(rows[1]?.practiceName).toBe("Red Bank Veterinary Hospital");
    expect(rows[1]?.reviewCount).toBe("412");
    expect(rows[2]?.reviewCount).toBe("0");
  });

  it("labels client ads as self-managed when extract says so and PPC not purchased", () => {
    const formWithOwnAds: StrategyMapperFormData = {
      ...form,
      salesPdfExtract: {
        summary: "",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo"],
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
    };
    const rows = assembleCompetitiveAuditRows(
      formWithOwnAds,
      { ...research, clientMetrics: { ...research.clientMetrics, runsGoogleAds: false } },
      ["seo"],
    );
    expect(rows[0]?.runsGoogleAds).toBe("Yes (self-managed)");
  });
});

describe("assembleActiveStrategies", () => {
  it("builds SEO Premium Plus block with AEO tactic", () => {
    const active = assembleActiveStrategies({ seo: "seo-premium-plus" }, tiers, ctx);
    expect(active.seo?.tactics.some((t) => t.includes("llms.txt"))).toBe(true);
    expect(active.seo?.tactics.some((t) => t.includes("Bayside Animal Hospital"))).toBe(true);
  });

  it("does not include TODO placeholders in ORM tiers", () => {
    const active = assembleActiveStrategies({ orm: "orm-foundation" }, tiers, ctx);
    const combined = JSON.stringify(active.orm);
    expect(combined).not.toContain("TODO");
    expect(active.orm?.tactics.some((t) => t.includes("Demandforce"))).toBe(true);
  });
});

describe("finalizeActiveStrategies", () => {
  it("replaces PPC tactics with audit copy when client runs own ads", () => {
    const formWithAds: StrategyMapperFormData = {
      ...form,
      activeServices: ["ppc"],
      salesPdfExtract: {
        summary: "",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["ppc"],
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
    };
    const adsCtx = { form: formWithAds, radius: calculateDualRadius(formWithAds) };
    const active = finalizeActiveStrategies(
      assembleActiveStrategies({ ppc: "ppc-premium" }, tiers, adsCtx),
      adsCtx,
    );
    expect(active.ppc?.tactics[0]).toContain("Full audit of existing Google Ads");
  });
});

describe("assembleStrategistChecklist", () => {
  it("returns four spec checklist items with practice name substituted", () => {
    const checklist = assembleStrategistChecklist(ctx);
    expect(checklist).toHaveLength(4);
    expect(checklist[0]).toContain("Bayside Animal Hospital");
    expect(checklist[1]).toContain("Google Search Console");
  });
});

describe("assembleGrowthOpportunityStubs", () => {
  it("uses spec PPC introduction observation for unselected PPC upsell", () => {
    const stubs = assembleGrowthOpportunityStubs(
      [{ tierKey: "ppc-premium", service: "ppc", directive: { service: "ppc", framing: "introduction" } }],
      tiers,
      ctx,
    );
    expect(stubs).toHaveLength(1);
    expect(stubs[0]?.service).toBe("ppc");
    expect(stubs[0]?.marketObservation).toBe(PPC_INTRODUCTION_UPSELL_OBSERVATION);
  });
});

describe("mergeDeterministicReport", () => {
  it("overwrites LLM activeStrategies with assembled blocks", () => {
    const checklist = assembleStrategistChecklist(ctx);
    const assembled = {
      activeStrategies: assembleActiveStrategies({ seo: "seo-foundation" }, tiers, ctx),
      growthOpportunityStubs: [],
      competitiveAuditRows: assembleCompetitiveAuditRows(form, research, ["seo"]),
      internalStrategistChecklist: checklist,
    };

    const merged = mergeDeterministicReport(
      {
        executiveSummary: {
          missionStatement: "Mission",
          narrative: "Narrative",
          painPointResolution: "Pain",
          coreFocusAreas: ["Focus"],
        },
        seoKeywordMatrix: [],
        growthOpportunities: [],
        launchRoadmap: [],
        activeStrategies: {
          seo: {
            title: "LLM invented",
            objective: "LLM objective",
            tactics: ["LLM tactic"],
          },
        },
        competitiveAuditRows: [
          {
            practiceName: "Hallucinated Vet",
            isClient: false,
            distance: "1 mi",
            googleRating: "5",
            reviewCount: "9999",
            runsGoogleAds: "Yes",
          },
        ],
      },
      assembled,
    );

    expect(merged.activeStrategies.seo?.title).toContain("Foundation");
    expect(merged.activeStrategies.seo?.tactics.some((t) => t.includes("GBP"))).toBe(true);
    expect(merged.internalStrategistChecklist).toEqual(checklist);
    expect(merged.competitiveAuditRows[0]?.practiceName).toBe("Bayside Animal Hospital");
    expect(merged.competitiveAuditRows.some((r) => r.practiceName === "Hallucinated Vet")).toBe(
      false,
    );
  });
});
