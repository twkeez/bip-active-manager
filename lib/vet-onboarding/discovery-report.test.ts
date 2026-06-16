import { describe, expect, it } from "vitest";
import {
  getCompetitiveEdgeQuote,
  getCompetitorGapBullets,
} from "@/components/vet-onboarding/output-helpers";
import { localResearchOutputFormat } from "@/lib/vet-onboarding/research-json-schema";
import type { DiscoveryReport } from "@/types/onboarding";

describe("localResearchOutputFormat", () => {
  it("defines required research fields", () => {
    expect(localResearchOutputFormat.type).toBe("json_schema");
  });
});

export const minimalDiscoveryReport: DiscoveryReport = {
  capacityStrategy: "Focus on surgical referral marketing.",
  uvpPositioning: "Lead with affordable orthopedic care.",
  reputationPlan: "Respond to all reviews within 48 hours.",
  websitePriorities: "Add transparent TPLO pricing page.",
  onlinePresenceAudit: [
    {
      asset: "Google Business Profile",
      currentState: "3.9 stars, 120 reviews",
      requiredFix: "Weekly posts with surgical outcomes",
      priority: "High",
    },
  ],
  competitorDeficitAnalysis: [
    {
      competitorName: "Red Bank Veterinary Hospital",
      competitorCategory: "Surgical referral hospital",
      theirStrength: "Strong regional brand recognition",
      digitalWeaknesses: [
        "No public TPLO pricing",
        "Weak Jackson map pack presence",
      ],
      yourAdvantage: "Half the TPLO price with 48-hour booking",
    },
  ],
  pricingComparison: [
    {
      competitorName: "Red Bank Veterinary Hospital",
      serviceOrProcedure: "TPLO surgery",
      competitorPriceNote: "$4,500+ estimated",
      yourPriceNote: "$2,200",
      valueAngle: "Affordable orthopedic care without sacrificing outcomes",
    },
  ],
  keywordGeoMatrix: [
    {
      campaignTier: "Local Wellness (0–10mi)",
      targetGeography: "Howell Township, Monmouth County",
      primaryKeywords: ["vet near me", "animal hospital Howell NJ"],
      searchIntent: "Local volume and relationship building",
    },
    {
      campaignTier: "Surgical Referral (30–50mi)",
      targetGeography: "Freehold, Toms River, Jackson",
      primaryKeywords: ["TPLO surgery NJ", "affordable ACL surgery NJ"],
      searchIntent: "High-ATV conversion from cost-conscious pet owners",
    },
  ],
  monthlyChecklist: [
    {
      task: "Post to GBP 2x weekly with surgical success stories",
      category: "GBP",
    },
  ],
  quarterlyChecklist: [
    {
      task: "Re-audit Red Bank and Barnside review velocity",
      category: "Competitor Audit",
    },
  ],
};

describe("DiscoveryReport helpers", () => {
  it("prefers pricing value angle for competitive edge quote", () => {
    expect(getCompetitiveEdgeQuote(minimalDiscoveryReport)).toBe(
      "Affordable orthopedic care without sacrificing outcomes",
    );
  });

  it("falls back to competitor advantage when pricing is empty", () => {
    const report: DiscoveryReport = {
      ...minimalDiscoveryReport,
      pricingComparison: [],
    };
    expect(getCompetitiveEdgeQuote(report)).toBe(
      "Half the TPLO price with 48-hour booking",
    );
  });

  it("returns competitor gap bullets from first deficit row", () => {
    expect(getCompetitorGapBullets(minimalDiscoveryReport)).toEqual([
      "No public TPLO pricing",
      "Weak Jackson map pack presence",
    ]);
  });

  it("includes all required structured discovery fields", () => {
    expect(minimalDiscoveryReport.onlinePresenceAudit.length).toBeGreaterThan(0);
    expect(minimalDiscoveryReport.competitorDeficitAnalysis.length).toBeGreaterThan(
      0,
    );
    expect(minimalDiscoveryReport.pricingComparison.length).toBeGreaterThan(0);
    expect(minimalDiscoveryReport.keywordGeoMatrix.length).toBeGreaterThanOrEqual(
      2,
    );
    expect(minimalDiscoveryReport.monthlyChecklist.length).toBeGreaterThan(0);
    expect(minimalDiscoveryReport.quarterlyChecklist.length).toBeGreaterThan(0);
  });
});
