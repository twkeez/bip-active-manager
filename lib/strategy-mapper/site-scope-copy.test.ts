import { describe, expect, it } from "vitest";
import { assembleFullReport } from "@/lib/strategy-mapper/assemble-report";
import { DEFAULT_CONTENT_FALLBACKS } from "@/lib/strategy-mapper/content-library";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import {
  applySiteScopeToActiveStrategies,
  applySiteScopeToReport,
} from "@/lib/strategy-mapper/site-scope-copy";
import { STRATEGIC_ARCHITECT_SEO_BLUEPRINT } from "@/lib/strategy-mapper/site-scope-constants";
import { buildActiveStrategyBlock } from "@/lib/strategy-mapper/tier-template-engine";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import {
  getUpsellTierCandidates,
  resolveSelectedTiers,
} from "@/lib/strategy-mapper/tier-resolver";
import { evaluateUpsellDirectives } from "@/lib/strategy-mapper/upsell-rules";
import {
  buildMandatorySeoAeoTactic,
  AEO_TACTIC_MARKER,
} from "@/lib/strategy-mapper/seo-aeo-tactic";
import { resolveActiveServices } from "@/lib/strategy-mapper/form-options";
import type {
  StrategyMapperFormData,
  StrategyMapperResearch,
} from "@/types/strategy-mapper";

const baseForm: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo", "ppc"],
  primaryGoal: "General new client acquisition / Market dominance",
  siteContext: "existing_active",
  strategicContextNotes: "",
  clientGoogleRating: "4.1",
  clientReviewCount: "85",
};

const baseResearch: StrategyMapperResearch = {
  densityTier: "suburban",
  wellnessRadiusMiles: 5,
  specialtyRadiusMiles: null,
  specialtyRadiusEnabled: false,
  radiusRationale: "Suburban default",
  clientMetrics: { googleRating: 4.1, reviewCount: 85, runsGoogleAds: true },
  competitors: [
    {
      name: "Red Bank Veterinary Hospital",
      distanceMiles: 5.2,
      googleRating: 4.5,
      reviewCount: 412,
      runsGoogleAds: true,
      scope: "local",
    },
  ],
};

const forbiddenPhrases = [
  "15-page website",
  "Rebuilding your CMS",
  "Delivering a new site platform",
  "root directory of the new website",
];

function seoPremiumPlusBlock(form: StrategyMapperFormData) {
  const tier = DEFAULT_TIER_FALLBACKS.find((t) => t.tierKey === "seo-premium-plus")!;
  const radius = calculateDualRadius(form);
  return buildActiveStrategyBlock(tier, { form, radius });
}

describe("buildMandatorySeoAeoTactic siteContext variants", () => {
  const radius = calculateDualRadius(baseForm);

  it("uses new website language only for brand_new_ground_up", () => {
    const tactic = buildMandatorySeoAeoTactic(
      { ...baseForm, siteContext: "brand_new_ground_up" },
      radius,
    );
    expect(tactic).toContain("new website");
  });

  it("uses active property language for existing_active", () => {
    const tactic = buildMandatorySeoAeoTactic(baseForm, radius, "existing_active");
    expect(tactic).not.toContain("new website");
    expect(tactic).toContain("active web property");
  });

  it("uses pre-launch sandbox language for launching_external_builder", () => {
    const tactic = buildMandatorySeoAeoTactic(
      { ...baseForm, siteContext: "launching_external_builder" },
      radius,
    );
    expect(tactic).toContain("sandboxed domain authority");
    expect(tactic).not.toContain("new website");
  });
});

describe("applySiteScopeToActiveStrategies", () => {
  it("pivots landing page ecosystem for launching_external_builder", () => {
    const form = { ...baseForm, siteContext: "launching_external_builder" as const };
    const radius = calculateDualRadius(form);
    const block = seoPremiumPlusBlock(form);
    const scoped = applySiteScopeToActiveStrategies({ seo: block }, { form, radius });
    const tactics = scoped.seo?.tactics.join(" ") ?? "";
    expect(tactics).toContain(STRATEGIC_ARCHITECT_SEO_BLUEPRINT);
    for (const phrase of forbiddenPhrases) {
      expect(tactics).not.toContain(phrase);
    }
  });

  it("retains build language for brand_new_ground_up", () => {
    const form = { ...baseForm, siteContext: "brand_new_ground_up" as const };
    const radius = calculateDualRadius(form);
    const block = seoPremiumPlusBlock(form);
    const scoped = applySiteScopeToActiveStrategies({ seo: block }, { form, radius });
    const aeo = scoped.seo?.tactics.find((t) => t.includes(AEO_TACTIC_MARKER)) ?? "";
    expect(aeo).toContain("new website");
  });
});

describe("assembleFullReport site context integration", () => {
  it("avoids forbidden web-dev phrasing for existing_active", () => {
    const radius = calculateDualRadius(baseForm);
    const activeServices = resolveActiveServices(baseForm.activeServices);
    const selectedTiers = resolveSelectedTiers(baseForm, activeServices, DEFAULT_TIER_FALLBACKS);
    const upsellDirectives = evaluateUpsellDirectives(activeServices, baseForm, baseResearch);
    const report = assembleFullReport({
      form: { ...baseForm, siteContext: "existing_active", tierOverrides: { seo: "seo-premium-plus" } },
      research: baseResearch,
      radius,
      activeServices,
      selectedTierKeys: { ...selectedTiers, seo: "seo-premium-plus" },
      tiers: DEFAULT_TIER_FALLBACKS,
      contentBlocks: DEFAULT_CONTENT_FALLBACKS,
      upsellDirectives,
      upsellTierCandidates: getUpsellTierCandidates(
        { ...selectedTiers, seo: "seo-premium-plus" },
        activeServices,
        DEFAULT_TIER_FALLBACKS,
        upsellDirectives,
      ),
    });

    const blob = JSON.stringify(report);
    for (const phrase of forbiddenPhrases) {
      expect(blob).not.toContain(phrase);
    }
  });

  it("uses strategic architect language for replacement_build_in_progress", () => {
    const form = {
      ...baseForm,
      siteContext: "replacement_build_in_progress" as const,
      tierOverrides: { seo: "seo-premium-plus" },
    };
    const radius = calculateDualRadius(form);
    const activeServices = resolveActiveServices(form.activeServices);
    const selectedTiers = resolveSelectedTiers(form, activeServices, DEFAULT_TIER_FALLBACKS);
    const upsellDirectives = evaluateUpsellDirectives(activeServices, form, baseResearch);
    const report = assembleFullReport({
      form,
      research: baseResearch,
      radius,
      activeServices,
      selectedTierKeys: { ...selectedTiers, seo: "seo-premium-plus" },
      tiers: DEFAULT_TIER_FALLBACKS,
      contentBlocks: DEFAULT_CONTENT_FALLBACKS,
      upsellDirectives,
      upsellTierCandidates: getUpsellTierCandidates(
        { ...selectedTiers, seo: "seo-premium-plus" },
        activeServices,
        DEFAULT_TIER_FALLBACKS,
        upsellDirectives,
      ),
    });

    expect(JSON.stringify(report)).toContain("sandbox/staging");
    expect(report.launchRoadmap[1]?.description).toContain("pre-launch SEO blueprints");
  });
});

describe("applySiteScopeToReport executive pivot", () => {
  it("replaces regional landing pages phrasing for existing_active", () => {
    const radius = calculateDualRadius(baseForm);
    const report = applySiteScopeToReport(
      {
        executiveSummary: {
          missionStatement: "Mission",
          narrative: "Narrative",
          painPointResolution: "Fix unresponsive web admin.",
          coreFocusAreas: ["Regional landing pages for TPLO"],
        },
        competitiveAuditRows: [],
        seoKeywordMatrix: [],
        activeStrategies: {},
        growthOpportunities: [],
        launchRoadmap: [],
        internalStrategistChecklist: [],
      },
      { form: baseForm, radius },
    );
    expect(report.executiveSummary.coreFocusAreas[0]).toContain("active web property");
    expect(report.executiveSummary.coreFocusAreas[0]).not.toMatch(/Regional landing pages/i);
  });
});
