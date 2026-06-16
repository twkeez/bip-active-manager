import { describe, expect, it } from "vitest";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import {
  buildBrandedStrategyMapperHtml,
  collectHighlightTerms,
  highlightClinicalTerms,
} from "@/lib/strategy-mapper/report-brand-html";
import { BRAND_COLORS, SERVICE_ICONS } from "@/lib/strategy-mapper/report-brand-tokens";
import type { StrategyMapperFormData, StrategyMapperReport } from "@/types/strategy-mapper";

const form: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "",
  specializations: ["Small Animal", "Orthopedics / Specialty"],
  customSpecialization: "",
  activeServices: ["seo", "ppc"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
  salesPdfExtract: {
    summary: "Orthopedic practice",
    painPoints: [],
    goals: [],
    agencyFrustrations: [],
    purchasedServices: ["seo", "ppc"],
    purchasedProductLabels: ["SEO Premium Plus", "Google Ads"],
    clinicalDifferentiator: "TPLO at ~half regional hospital cost",
    primaryProcedures: ["TPLO"],
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

const radius = calculateDualRadius(form);

const report: StrategyMapperReport = {
  executiveSummary: {
    missionStatement: "Dominate TPLO search in Monmouth County.",
    narrative: "Focus on regional orthopedic draw.",
    painPointResolution: "Fix review syndication.",
    coreFocusAreas: ["TPLO pricing transparency"],
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
      intentCategory: "Local Core",
      targetGeography: "Howell (5 mi)",
      keywordVariations: ["vet near me"],
    },
  ],
  activeStrategies: {
    seo: {
      title: "Search Engine Optimization (SEO) — Premium Plus",
      objective: "Establish dominance for TPLO cases.",
      tactics: ["Deploy llms.txt for Fear Free Certified capabilities."],
    },
    ppc: {
      title: "Pay-Per-Click Advertising (PPC) — Premium",
      objective: "Capture urgent vet care searches.",
      tactics: ["Build Google Ads campaigns for veterinarian near me."],
    },
  },
  growthOpportunities: [
    {
      service: "social",
      title: "Social Media Marketing — Standard",
      marketObservation: "Competitors post weekly on Facebook.",
      whyItMatters: "Social trust gap vs regional rivals.",
    },
  ],
  launchRoadmap: [
    { stepNumber: 1, title: "Kickoff Meeting", description: "Align on goals." },
  ],
  internalStrategistChecklist: [
    "Claiming and verifying Google Business Profile access for Bayside Animal Hospital.",
    "Property mappings in Google Search Console and GA4 pixel staging.",
  ],
};

describe("highlightClinicalTerms", () => {
  it("wraps TPLO and form specializations in pink spans", () => {
    const result = highlightClinicalTerms(
      "TPLO recovery and Orthopedics / Specialty landing pages.",
      form,
    );
    expect(result).toContain(`color: ${BRAND_COLORS.brandPink}`);
    expect(result).toContain("TPLO");
    expect(result).toContain("Orthopedics / Specialty");
  });

  it("collects terms from form and extract", () => {
    const terms = collectHighlightTerms(form);
    expect(terms).toContain("TPLO");
    expect(terms).toContain("Orthopedics / Specialty");
    expect(terms).toContain("llms.txt");
  });
});

describe("buildBrandedStrategyMapperHtml", () => {
  it("uses brand kit inline styles for headings and table", () => {
    const html = buildBrandedStrategyMapperHtml(form, report, radius, ["seo", "ppc"]);
    expect(html).toContain(BRAND_COLORS.brandPurple);
    expect(html).toContain(BRAND_COLORS.brandBlue);
    expect(html).toContain(BRAND_COLORS.brandPink);
    expect(html).toContain("font-size: 28px");
    expect(html).toContain("font-size: 20px");
    expect(html).toContain("padding: 12px");
  });

  it("prefixes Phase 1 service blocks with icons", () => {
    const html = buildBrandedStrategyMapperHtml(form, report, radius, ["seo", "ppc"]);
    expect(html).toContain(`${SERVICE_ICONS.seo} Search Engine Optimization`);
    expect(html).toContain(`${SERVICE_ICONS.ppc} Pay-Per-Click Advertising`);
  });

  it("renders Phase 2 observation blocks as styled divs not blockquote", () => {
    const html = buildBrandedStrategyMapperHtml(form, report, radius, ["seo", "ppc"]);
    expect(html).not.toContain("<blockquote");
    expect(html).toContain(`background-color: ${BRAND_COLORS.brandWash}`);
    expect(html).toContain(`border-left: 4px solid ${BRAND_COLORS.brandPurple}`);
    expect(html).toContain("Market Observation:");
    expect(html).toContain("Why It Matters:");
  });

  it("includes checklist section", () => {
    const html = buildBrandedStrategyMapperHtml(form, report, radius, ["seo", "ppc"]);
    expect(html).toContain("INTERNAL STRATEGIST IMPLEMENTATION CHECKLIST");
    expect(html).toContain("☐");
    expect(html).toContain("Google Search Console");
  });
});
