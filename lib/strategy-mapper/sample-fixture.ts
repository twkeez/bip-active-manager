import { assembleActiveStrategies } from "@/lib/strategy-mapper/assemble-report";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import type {
  StrategyMapperFormData,
  StrategyMapperGenerateResult,
  StrategyMapperReport,
} from "@/types/strategy-mapper";

export const SAMPLE_STRATEGY_MAPPER_FORM: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "Monmouth County suburban corridor",
  specializations: ["Small Animal", "Orthopedics / Specialty"],
  customSpecialization: "",
  activeServices: ["seo", "ppc"],
  primaryGoal: "Increase high-ticket dental, surgical, or therapeutic procedures",
  strategicContextNotes:
    "Sample document for layout and branding preview — all data is placeholder.",
  clientGoogleRating: "4.1",
  clientReviewCount: "85",
  tierOverrides: {
    seo: "seo-premium-plus",
    ppc: "ppc-premium",
  },
  salesPdfExtract: {
    summary: "Single-doctor orthopedic-forward practice seeking regional TPLO draw.",
    painPoints: [
      "Demandforce closed-loop reviews not syndicating to Google",
      "Previous agency unresponsive on website updates",
    ],
    goals: ["Increase TPLO case volume", "Fill associate DVM calendar"],
    agencyFrustrations: ["Unresponsive web admin", "Generic copy with no clinical specificity"],
    purchasedServices: ["seo", "ppc"],
    purchasedProductLabels: ["SEO Premium Plus", "Google Ads"],
    clinicalDifferentiator: "TPLO at ~half regional referral hospital cost",
    primaryProcedures: ["TPLO", "Tibial Plateau Leveling Osteotomy"],
    clientRunsOwnAds: false,
    adsPerformanceNote: "",
    vendorPlatforms: ["Demandforce"],
    ormProgramName: "",
    socialContentThemes: ["before-and-after success stories", "orthopedic recovery"],
    primarySocialPlatform: "Facebook",
    socialAdsHistory: "Historically ran Facebook ads successfully",
    operationalBottlenecks: ["1 doctor, 11 staff"],
    capacityNotes: "Associate DVM has open appointment blocks",
    vendorFrustrations: ["Demandforce closed-loop reviews"],
    staffConstraints: "1 doctor, 11 staff",
    doctorCount: "1",
    clientPersonaTone: "standard",
  },
};

const sampleRadius = calculateDualRadius(SAMPLE_STRATEGY_MAPPER_FORM);

const sampleActiveStrategies = assembleActiveStrategies(
  { seo: "seo-premium-plus", ppc: "ppc-premium" },
  DEFAULT_TIER_FALLBACKS,
  { form: SAMPLE_STRATEGY_MAPPER_FORM, radius: sampleRadius },
);

export const SAMPLE_STRATEGY_MAPPER_REPORT: StrategyMapperReport = {
  executiveSummary: {
    missionStatement:
      "Position Bayside Animal Hospital as the premier TPLO and orthopedic choice for Monmouth County pet parents — with transparent pricing that undercuts regional referral hospitals.",
    narrative:
      "This sample plan illustrates branded document layout, tier-library Phase 1 blurbs, competitive audit formatting, and Phase 2 observation callouts. Replace all placeholder prose after running a live generation.",
    painPointResolution:
      "We will transition review velocity off Demandforce's closed-loop platform and into public Google Business Profile syndication, while freeing the practice from unresponsive web administration.",
    coreFocusAreas: [
      "Transparent TPLO pricing published on-site and in ad copy",
      "Regional orthopedic landing pages targeting Howell and surrounding townships",
      "GBP review velocity correction and local map pack dominance",
      "Associate DVM calendar fill via high-intent wellness keywords",
    ],
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
    {
      practiceName: "Red Bank Veterinary Hospital",
      isClient: false,
      distance: "5.2 mi",
      googleRating: "4.5",
      reviewCount: "412",
      runsGoogleAds: "Yes",
    },
    {
      practiceName: "Freehold Animal Hospital",
      isClient: false,
      distance: "8.1 mi",
      googleRating: "4.3",
      reviewCount: "218",
      runsGoogleAds: "No",
    },
    {
      practiceName: "Monmouth County Veterinary Specialists",
      isClient: false,
      distance: "12.4 mi",
      googleRating: "4.6",
      reviewCount: "891",
      runsGoogleAds: "Yes",
    },
  ],
  seoKeywordMatrix: [
    {
      intentCategory: "Local Core (General Wellness)",
      targetGeography: "Howell Township (5 mi)",
      keywordVariations: [
        "vet near me",
        "animal hospital Howell NJ",
        "veterinarian Howell",
      ],
    },
    {
      intentCategory: "High-Intent Specialty (Regional)",
      targetGeography: "Monmouth County (40 mi)",
      keywordVariations: [
        "TPLO surgery NJ",
        "dog ACL repair near me",
        "affordable TPLO veterinarian",
      ],
    },
  ],
  activeStrategies: sampleActiveStrategies,
  growthOpportunities: [
    {
      service: "social",
      title: "Social Media Marketing — Standard",
      marketObservation:
        "Competitors maintain weekly Facebook cadence with community engagement, while Bayside has no structured social content program despite sales notes requesting before-and-after success stories.",
      whyItMatters:
        "Regional pet parents researching TPLO providers increasingly validate trust through social proof — a structured case-transformation gallery can pre-sell complex stays before the first phone call.",
      framing: "community",
    },
    {
      service: "orm",
      title: "Online Reputation Management (ORM) — Foundation",
      marketObservation:
        "Bayside trails the top local competitor by 327 Google reviews — a reputation gap that suppresses map pack visibility for high-intent wellness searches.",
      whyItMatters:
        "Closing the review velocity gap is the fastest lever to improve local conversion rates without increasing ad spend.",
      framing: "reputation_gap",
    },
  ],
  launchRoadmap: [
    {
      stepNumber: 1,
      title: "Kickoff Meeting",
      description:
        "Align on TPLO regional positioning, associate calendar goals, and Demandforce-to-GBP review migration timeline.",
    },
    {
      stepNumber: 2,
      title: "Technical Asset Gathering",
      description:
        "Collect GBP admin, Google Ads access, website CMS logins, and before-and-after case media for orthopedic gallery.",
    },
    {
      stepNumber: 3,
      title: "Strategy Launch Day",
      description:
        "Publish tier-library Phase 1 tactics, activate keyword matrix targets, and schedule first 30-day optimization checkpoint.",
    },
  ],
  internalStrategistChecklist: [
    "Claiming and verifying Google Business Profile access for Summit Veterinary Orthopedics.",
    "Property mappings in Google Search Console and GA4 pixel staging.",
    "Baseline technical auditing via Google Lighthouse and Screaming Frog.",
    "Structuring localized keyword maps and building the client onboarding workspace.",
  ],
};

export const SAMPLE_STRATEGY_MAPPER_RESULT: StrategyMapperGenerateResult = {
  research: {
    densityTier: sampleRadius.densityTier,
    wellnessRadiusMiles: sampleRadius.wellnessRadiusMiles,
    specialtyRadiusMiles: sampleRadius.specialtyRadiusMiles,
    specialtyRadiusEnabled: sampleRadius.specialtyRadiusEnabled,
    radiusRationale: sampleRadius.rationale,
    clientMetrics: {
      googleRating: 4.1,
      reviewCount: 85,
      runsGoogleAds: true,
    },
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
        name: "Freehold Animal Hospital",
        distanceMiles: 8.1,
        googleRating: 4.3,
        reviewCount: 218,
        runsGoogleAds: false,
        scope: "local",
      },
      {
        name: "Monmouth County Veterinary Specialists",
        distanceMiles: 12.4,
        googleRating: 4.6,
        reviewCount: 891,
        runsGoogleAds: true,
        scope: "regional",
      },
    ],
  },
  report: SAMPLE_STRATEGY_MAPPER_REPORT,
  upsellDirectives: [
    { service: "social", framing: "community" },
    { service: "orm", framing: "reputation_gap" },
  ],
  radius: sampleRadius,
  activeServices: ["seo", "ppc"],
};

export function getSampleStrategyMapperResult(): StrategyMapperGenerateResult {
  return SAMPLE_STRATEGY_MAPPER_RESULT;
}
