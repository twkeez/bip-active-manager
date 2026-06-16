import { describe, expect, it } from "vitest";
import {
  assembleActiveStrategies,
  assembleFullReport,
} from "@/lib/strategy-mapper/assemble-report";
import {
  DEFAULT_CONTENT_FALLBACKS,
  interpolateContentText,
} from "@/lib/strategy-mapper/content-library";
import {
  buildStrategyMapperHtml,
  buildStrategyMapperPlainText,
} from "@/lib/strategy-mapper/copy-rich-html";
import { resolveActiveServices } from "@/lib/strategy-mapper/form-options";
import {
  calculateDualRadius,
  calculateTargetRadius,
  hasHighTicketSpecialization,
} from "@/lib/strategy-mapper/radius";
import { evaluateUpsellDirectives, evaluateUpsellTriggers } from "@/lib/strategy-mapper/upsell-rules";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import {
  getUpsellTierCandidates,
  resolveSelectedTiers,
} from "@/lib/strategy-mapper/tier-resolver";
import {
  sanitizeReport,
  stripMissionLabelPrefix,
  stripPainPointLabelPrefix,
} from "@/lib/strategy-mapper/report-sanitize";
import {
  buildStrategyMapperReportPrompt,
  buildSalesNotesExtractionPrompt,
} from "@/lib/strategy-mapper/prompts";
import type {
  StrategyMapperFormData,
  StrategyMapperReport,
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
  strategicContextNotes: "Fill Dr. Jones calendar.",
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

const baseRadius = calculateDualRadius(baseForm);

const baseReport: StrategyMapperReport = {
  executiveSummary: {
    missionStatement: "Get more tails through the door in Monmouth County.",
    narrative: "We will focus on local dominance.",
    painPointResolution: "Fix the Demandforce review loop on Google.",
    coreFocusAreas: ["Transparent TPLO pricing", "Free from unresponsive web admin"],
  },
  competitiveAuditRows: [
    {
      practiceName: "Bayside Animal Hospital",
      isClient: true,
      distance: "—",
      googleRating: "4.1",
      reviewCount: "85",
      runsGoogleAds: "Yes",
    },
  ],
  seoKeywordMatrix: [
    {
      intentCategory: "Local Core (General Wellness)",
      targetGeography: "Howell Township (5 mi)",
      keywordVariations: ["vet near me", "animal clinic Howell NJ"],
    },
  ],
  activeStrategies: {
    seo: {
      title: "SEO Strategy",
      objective: "Dominate local map pack.",
      tactics: ["Optimize GBP", "Target vet near me"],
    },
  },
  growthOpportunities: [],
  launchRoadmap: [
    { stepNumber: 1, title: "Kickoff Meeting", description: "Align on goals." },
    { stepNumber: 2, title: "Technical Asset Gathering", description: "Collect logins." },
    { stepNumber: 3, title: "Strategy Launch Day", description: "Go live." },
  ],
  internalStrategistChecklist: [
    "Schedule kickoff call with practice owner",
    "Collect GBP admin access",
  ],
};

describe("calculateDualRadius", () => {
  it("uses urban 3-mile wellness radius for downtown addresses", () => {
    const result = calculateDualRadius({
      ...baseForm,
      streetAddress: "100 Broadway, New York, NY 10005",
      locationNotes: "Downtown Manhattan location",
    });
    expect(result.densityTier).toBe("urban");
    expect(result.wellnessRadiusMiles).toBe(3);
  });

  it("uses suburban 5-mile wellness radius by default", () => {
    const result = calculateDualRadius(baseForm);
    expect(result.wellnessRadiusMiles).toBe(5);
  });

  it("enables specialty regional radius for orthopedics", () => {
    const result = calculateDualRadius({
      ...baseForm,
      specializations: ["Orthopedics / Specialty"],
    });
    expect(result.specialtyRadiusEnabled).toBe(true);
    expect(result.specialtyRadiusMiles).toBe(40);
    expect(result.geographicFocusLabel).toContain("Regional Surgical Grid");
  });

  it("expands rural to suburban when notes mention metro draw", () => {
    const result = calculateTargetRadius(
      "12 Rural Route 1, Jackson, NJ 08527",
      "Drawing from nearby metro area within 20 miles",
    );
    expect(result.densityTier).toBe("suburban");
    expect(result.wellnessRadiusMiles).toBe(5);
  });
});

describe("hasHighTicketSpecialization", () => {
  it("detects surgical specializations", () => {
    expect(
      hasHighTicketSpecialization({
        ...baseForm,
        specializations: ["Surgical & Diagnostics"],
      }),
    ).toBe(true);
  });
});

describe("resolveActiveServices", () => {
  it("uses form selection only", () => {
    expect(resolveActiveServices(["seo"], ["ppc", "orm"])).toEqual(["seo"]);
  });
});

describe("assembleFullReport", () => {
  it("builds a deterministic report from content and tier libraries", () => {
    const activeServices = resolveActiveServices(baseForm.activeServices);
    const selectedTiers = resolveSelectedTiers(baseForm, activeServices, DEFAULT_TIER_FALLBACKS);
    const upsellDirectives = evaluateUpsellDirectives(activeServices, baseForm, baseResearch);
    const upsellTierCandidates = getUpsellTierCandidates(
      selectedTiers,
      activeServices,
      DEFAULT_TIER_FALLBACKS,
      upsellDirectives,
    );

    const report = assembleFullReport({
      form: baseForm,
      research: baseResearch,
      radius: baseRadius,
      activeServices,
      selectedTierKeys: selectedTiers,
      tiers: DEFAULT_TIER_FALLBACKS,
      contentBlocks: DEFAULT_CONTENT_FALLBACKS,
      upsellDirectives,
      upsellTierCandidates,
    });

    expect(report.executiveSummary.missionStatement).toContain("Bayside Animal Hospital");
    expect(report.seoKeywordMatrix.length).toBeGreaterThan(0);
    expect(report.launchRoadmap).toHaveLength(3);
    expect(report.competitiveAuditRows[0]?.practiceName).toBe("Bayside Animal Hospital");
    expect(report.activeStrategies.seo).toBeDefined();
    expect(report.internalStrategistChecklist.length).toBe(4);
  });

  it("interpolates competitor placeholders in upsell copy", () => {
    const text = interpolateContentText(
      "Closing the [Review Gap]-review gap vs [Top Competitor].",
      {
        form: baseForm,
        radius: baseRadius,
        research: baseResearch,
        activeServices: ["seo", "ppc"],
      },
    );
    expect(text).toContain("Red Bank Veterinary Hospital");
    expect(text).toContain("327");
  });
});

describe("evaluateUpsellDirectives", () => {
  it("triggers ORM with reputation_gap when review gap exceeds 100", () => {
    const directives = evaluateUpsellDirectives(["seo", "ppc"], baseForm, baseResearch);
    const orm = directives.find((d) => d.service === "orm");
    expect(orm?.framing).toBe("reputation_gap");
  });

  it("triggers PPC with introduction when competitors run ads and client does not", () => {
    const directives = evaluateUpsellDirectives(["seo"], baseForm, baseResearch);
    const ppc = directives.find((d) => d.service === "ppc");
    expect(ppc?.framing).toBe("introduction");
  });

  it("triggers PPC with optimization when client runs own ads", () => {
    const formWithOwnAds: StrategyMapperFormData = {
      ...baseForm,
      activeServices: ["seo", "orm"],
      salesPdfExtract: {
        summary: "Howell orthopedic practice",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo", "orm"],
        purchasedProductLabels: ["SEO Local", "ORM Premium Plus"],
        clinicalDifferentiator: "TPLO at ~half regional hospital cost",
        primaryProcedures: ["TPLO", "Tibial Plateau Leveling Osteotomy"],
        clientRunsOwnAds: true,
        adsPerformanceNote: "self-managed Google Ads are their most effective channel",
        vendorPlatforms: ["Demandforce"],
        ormProgramName: "ORM Premium Plus",
        socialContentThemes: [],
        primarySocialPlatform: "",
        socialAdsHistory: "",
        operationalBottlenecks: [],
        capacityNotes: "",
        vendorFrustrations: ["Demandforce closed-loop reviews"],
        staffConstraints: "1 doctor, 11 staff",
        doctorCount: "1",
        clientPersonaTone: "no-nonsense",
      },
    };
    const directives = evaluateUpsellDirectives(
      ["seo", "orm"],
      formWithOwnAds,
      baseResearch,
    );
    expect(directives.find((d) => d.service === "orm")).toBeUndefined();
    const ppc = directives.find((d) => d.service === "ppc");
    expect(ppc?.framing).toBe("optimization");
  });

  it("always triggers social with community framing when unselected", () => {
    const directives = evaluateUpsellDirectives(["seo", "ppc"], baseForm, baseResearch);
    const social = directives.find((d) => d.service === "social");
    expect(social?.framing).toBe("community");
  });
});

describe("evaluateUpsellTriggers", () => {
  it("triggers ORM when review gap exceeds 100", () => {
    const triggered = evaluateUpsellTriggers(["seo", "ppc"], baseForm, baseResearch);
    expect(triggered).toContain("orm");
  });

  it("triggers PPC when competitors run ads and PPC is unselected", () => {
    const triggered = evaluateUpsellTriggers(["seo"], baseForm, baseResearch);
    expect(triggered).toContain("ppc");
  });

  it("always triggers social when unselected", () => {
    const triggered = evaluateUpsellTriggers(["seo", "ppc"], baseForm, baseResearch);
    expect(triggered).toContain("social");
  });
});

describe("sanitizeReport", () => {
  it("removes ORM from growthOpportunities when ORM is active", () => {
    const reportWithBadUpsell: StrategyMapperReport = {
      ...baseReport,
      growthOpportunities: [
        {
          service: "orm",
          title: "ORM Upsell",
          marketObservation: "Review gap",
          whyItMatters: "Should not appear",
        },
        {
          service: "social",
          title: "Social",
          marketObservation: "Community gap",
          whyItMatters: "Valid upsell",
        },
      ],
    };
    const sanitized = sanitizeReport(
      reportWithBadUpsell,
      ["seo", "orm"],
      ["social", "ppc"],
    );
    expect(sanitized.growthOpportunities.map((g) => g.service)).toEqual(["social"]);
    expect(sanitized.activeStrategies.orm).toBeUndefined();
  });

  it("strips activeStrategies keys not in activeServices", () => {
    const reportWithExtra: StrategyMapperReport = {
      ...baseReport,
      activeStrategies: {
        seo: baseReport.activeStrategies.seo!,
        ppc: {
          title: "PPC",
          objective: "Should be removed",
          tactics: ["Run ads"],
        },
      },
    };
    const sanitized = sanitizeReport(reportWithExtra, ["seo"], []);
    expect(sanitized.activeStrategies.ppc).toBeUndefined();
    expect(sanitized.activeStrategies.seo).toBeDefined();
  });

  it("clears seoKeywordMatrix when seo is not active", () => {
    const sanitized = sanitizeReport(baseReport, ["ppc"], []);
    expect(sanitized.seoKeywordMatrix).toEqual([]);
  });

  it("uses assembled activeStrategies when provided", () => {
    const assembled = {
      activeStrategies: assembleActiveStrategies(
        { seo: "seo-premium-plus" },
        DEFAULT_TIER_FALLBACKS,
        { form: baseForm, radius: baseRadius },
      ),
      growthOpportunityStubs: [],
      competitiveAuditRows: [],
      internalStrategistChecklist: [],
    };
    const sanitized = sanitizeReport(baseReport, ["seo"], [], undefined, assembled);
    const tactics = sanitized.activeStrategies.seo?.tactics ?? [];
    expect(tactics.some((t) => t.includes("llms.txt"))).toBe(true);
    expect(tactics.some((t) => t.includes("Bayside Animal Hospital"))).toBe(true);
  });

  it("preserves growth stub marketObservation when assembled stubs provided", () => {
    const stub = {
      service: "social" as const,
      title: "Social Media Marketing — Standard",
      marketObservation: "Standardized upsell observation text.",
      whyItMatters: "LLM competitive context.",
    };
    const reportWithGrowth: StrategyMapperReport = {
      ...baseReport,
      growthOpportunities: [
        {
          service: "social",
          title: "LLM title",
          marketObservation: "LLM rewritten observation",
          whyItMatters: "LLM competitive context.",
        },
      ],
    };
    const sanitized = sanitizeReport(
      reportWithGrowth,
      ["seo"],
      ["social"],
      undefined,
      { activeStrategies: {}, growthOpportunityStubs: [stub], competitiveAuditRows: [], internalStrategistChecklist: [] },
    );
    expect(sanitized.growthOpportunities[0]?.marketObservation).toBe(
      "Standardized upsell observation text.",
    );
    expect(sanitized.growthOpportunities[0]?.whyItMatters).toBe(
      "LLM competitive context.",
    );
  });

  it("strips duplicate Our Shared Mission prefix from missionStatement", () => {
    const reportWithDoubleLabel: StrategyMapperReport = {
      ...baseReport,
      executiveSummary: {
        ...baseReport.executiveSummary,
        missionStatement:
          "Our Shared Mission: Our Shared Mission: Howell Animal Hospital will dominate regional TPLO search.",
      },
    };
    const sanitized = sanitizeReport(reportWithDoubleLabel, ["seo"], []);
    expect(sanitized.executiveSummary.missionStatement).toBe(
      "Howell Animal Hospital will dominate regional TPLO search.",
    );
  });

  it("strips duplicate pain-point label from painPointResolution", () => {
    const reportWithDoubleLabel: StrategyMapperReport = {
      ...baseReport,
      executiveSummary: {
        ...baseReport.executiveSummary,
        painPointResolution:
          "Direct Pain-Point Resolution: Direct Pain-Point Resolution: Fix Demandforce loop.",
      },
    };
    const sanitized = sanitizeReport(reportWithDoubleLabel, ["seo"], []);
    expect(sanitized.executiveSummary.painPointResolution).toBe(
      "Fix Demandforce loop.",
    );
  });
});

describe("stripMissionLabelPrefix", () => {
  it("removes label prefix case-insensitively", () => {
    expect(stripMissionLabelPrefix("Our Shared Mission: Howell...")).toBe(
      "Howell...",
    );
  });

  it("removes repeated label prefixes", () => {
    expect(
      stripMissionLabelPrefix(
        "Our Shared Mission: Our Shared Mission: Howell Animal Hospital",
      ),
    ).toBe("Howell Animal Hospital");
  });
});

describe("stripPainPointLabelPrefix", () => {
  it("removes repeated pain-point label prefixes", () => {
    expect(
      stripPainPointLabelPrefix(
        "Direct Pain-Point Resolution: Direct Pain-Point Resolution: Fix reviews.",
      ),
    ).toBe("Fix reviews.");
  });
});

describe("prompts", () => {
  it("includes CRITICAL MATRIX CHECK in sales extraction prompt", () => {
    expect(buildSalesNotesExtractionPrompt()).toContain("CRITICAL MATRIX CHECK");
    expect(buildSalesNotesExtractionPrompt()).toContain("clientRunsOwnAds");
    expect(buildSalesNotesExtractionPrompt()).toContain("primaryProcedures");
  });

  it("includes clinical differentiator and strict protocol in report prompt", () => {
    const formWithFacts: StrategyMapperFormData = {
      ...baseForm,
      salesPdfExtract: {
        summary: "Orthopedic practice",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo", "orm"],
        purchasedProductLabels: ["ORM Premium Plus"],
        clinicalDifferentiator: "TPLO at ~half regional hospital cost",
        primaryProcedures: ["TPLO", "Tibial Plateau Leveling Osteotomy"],
        clientRunsOwnAds: true,
        adsPerformanceNote: "ads work well",
        vendorPlatforms: ["Demandforce"],
        ormProgramName: "ORM Premium Plus",
        socialContentThemes: [],
        primarySocialPlatform: "",
        socialAdsHistory: "",
        operationalBottlenecks: [],
        capacityNotes: "",
        vendorFrustrations: [],
        staffConstraints: "1 doctor",
        doctorCount: "1",
        clientPersonaTone: "standard",
      },
    };
    const prompt = buildStrategyMapperReportPrompt(
      formWithFacts,
      baseResearch,
      [{ service: "ppc", framing: "optimization" }],
      baseRadius,
      ["seo", "orm"],
      ["Search Engine Optimization (SEO) (SEO Foundation)", "ORM (ORM Premium)"],
      [],
      DEFAULT_TIER_FALLBACKS,
    );
    expect(prompt).toContain("STRICT FACT-CHECKING PROTOCOL");
    expect(prompt).toContain("VERIFIED RESEARCH PAYLOAD");
    expect(prompt).toContain("ABSOLUTE TRUTH");
    expect(prompt).toContain('"googleRating": 4.1');
    expect(prompt).toContain("Red Bank Veterinary Hospital");
    expect(prompt).toContain("do NOT output competitiveAuditRows");
    expect(prompt).toContain("TPLO at ~half regional hospital cost");
    expect(prompt).toContain("WEAPONIZE PRIMARY CLINICAL DIFFERENTIATORS");
    expect(prompt).toContain("TPLO");
    expect(prompt).toContain("high-value procedures");
    expect(prompt).toContain("FORBIDDEN PHRASES");
    expect(prompt).toContain("PPC Advertising Optimization");
    expect(prompt).toMatch(/FORBIDDEN PHRASES[\s\S]*introduce PPC/);
    expect(prompt).toContain("body text ONLY");
  });

  it("states Phase 1 is pre-assembled from tier library", () => {
    const prompt = buildStrategyMapperReportPrompt(
      baseForm,
      baseResearch,
      [],
      baseRadius,
      ["seo"],
      ["Search Engine Optimization (SEO) (SEO Premium Plus)"],
      [],
      DEFAULT_TIER_FALLBACKS,
    );
    expect(prompt).toContain("PRE-ASSEMBLED");
    expect(prompt).toContain("do NOT output activeStrategies");
    expect(prompt).toContain("do NOT output internalStrategistChecklist");
  });

  it("includes social media specificity when social upsell is triggered", () => {
    const formWithSocial: StrategyMapperFormData = {
      ...baseForm,
      salesPdfExtract: {
        summary: "Orthopedic practice",
        painPoints: [],
        goals: [],
        agencyFrustrations: [],
        purchasedServices: ["seo", "orm"],
        purchasedProductLabels: [],
        clinicalDifferentiator: "",
        primaryProcedures: [],
        clientRunsOwnAds: true,
        adsPerformanceNote: "",
        vendorPlatforms: [],
        ormProgramName: "",
        socialContentThemes: ["before-and-after success stories", "orthopedic recovery"],
        primarySocialPlatform: "Facebook",
        socialAdsHistory: "historically ran Facebook ads successfully",
        operationalBottlenecks: [],
        capacityNotes: "",
        vendorFrustrations: [],
        staffConstraints: "",
        doctorCount: "",
        clientPersonaTone: "standard",
      },
    };
    const prompt = buildStrategyMapperReportPrompt(
      formWithSocial,
      baseResearch,
      [{ service: "social", framing: "community" }],
      baseRadius,
      ["seo", "orm"],
      ["Search Engine Optimization (SEO) (SEO Foundation)", "ORM (ORM Premium)"],
      [{ tierKey: "social-standard", service: "social", directive: { service: "social", framing: "community" } }],
      DEFAULT_TIER_FALLBACKS,
    );
    expect(prompt).toContain("SOCIAL MEDIA SPECIFICITY");
    expect(prompt).toContain("CASE TRANSFORMATION WORKFLOWS");
    expect(prompt).toContain("before-and-after");
    expect(prompt).toContain("Facebook");
    expect(prompt).toContain("historically ran Facebook ads successfully");
  });
});

describe("copy-rich-html", () => {
  it("includes branded styles and mission in HTML export", () => {
    const html = buildStrategyMapperHtml(
      baseForm,
      baseReport,
      baseRadius,
      ["seo"],
    );
    expect(html).toContain("#B31B6B");
    expect(html).toContain("#2A52BE");
    expect(html).toContain("Our Shared Mission:");
    expect(html).toContain("Direct Pain-Point Resolution");
    expect(html).toContain("Google Rating");
    expect(html).toContain("Launch Roadmap");
    expect(html).not.toContain("<blockquote");
  });

  it("includes executive summary in plain text export", () => {
    const reportWithPrefixedMission: StrategyMapperReport = {
      ...baseReport,
      executiveSummary: {
        ...baseReport.executiveSummary,
        missionStatement:
          "Our Shared Mission: Get more tails through the door in Monmouth County.",
      },
    };
    const plain = buildStrategyMapperPlainText(
      baseForm,
      reportWithPrefixedMission,
      baseRadius,
      ["seo"],
    );
    expect(plain).toContain("Our Shared Mission: Get more tails through the door");
    expect(plain).not.toContain("Our Shared Mission: Our Shared Mission:");
  });

  it("includes checklist in plain text export", () => {
    const plain = buildStrategyMapperPlainText(baseForm, baseReport, baseRadius, ["seo"]);
    expect(plain).toContain("INTERNAL STRATEGIST IMPLEMENTATION CHECKLIST");
    expect(plain).toContain("Schedule kickoff call");
  });
});
