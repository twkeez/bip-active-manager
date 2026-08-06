import { describe, expect, it } from "vitest";
import { diagnoseAccount } from "@/lib/ads/account-diagnostic";
import type {
  AccountDiagnosticRaw,
  DiagAuction,
  DiagCampaign,
  DiagConvAction,
  DiagKeyword,
} from "@/lib/ads/account-diagnostic-fetch";
import type { AdsQualityBucket } from "@/lib/types/client";

function campaign(p: Partial<DiagCampaign>): DiagCampaign {
  return {
    id: "1", name: "Campaign", channel: "SEARCH", bidStrategy: "MAXIMIZE_CONVERSIONS",
    budget: 50, cost: 100, impr: 1000, clicks: 100, ctr: 1, conv: 10, convVal: 0,
    IS: 50, absTopIS: 50, topIS: 60, lostBudget: 0, lostRank: 0, ...p,
  };
}
function convAction(p: Partial<DiagConvAction>): DiagConvAction {
  return { name: "Action", type: "WEBPAGE", category: "SUBMIT_LEAD_FORM", status: "ENABLED", counting: "ONE_PER_CLICK", ...p };
}
function keyword(p: Partial<DiagKeyword>): DiagKeyword {
  return {
    campaign: "C", campaignId: "1", kw: "kw", match: "EXACT", qs: 6, cost: 10, clicks: 10, conv: 1,
    absTopIS: 40, adRelevance: "AVERAGE" as AdsQualityBucket, landingPage: "AVERAGE" as AdsQualityBucket,
    expectedCtr: "AVERAGE" as AdsQualityBucket, ...p,
  };
}
function raw(p: Partial<AccountDiagnosticRaw>): AccountDiagnosticRaw {
  return {
    customerId: "123-456-7890",
    window: { start: "2026-06-22", end: "2026-07-21" },
    conversionActions: [], campaigns: [], prev: { cost: 0, clicks: 0, conv: 0 },
    auction: [], searchTerms: [], keywords: [], device: [], ...p,
  };
}

describe("conversion trust", () => {
  it("flags a pixel loop (conversions >= clicks) as broken", () => {
    const d = diagnoseAccount(raw({
      campaigns: [campaign({ clicks: 50, conv: 60, cost: 100 })],
      conversionActions: [convAction({ name: "Lead" })],
    }));
    expect(d.conversionTrust.verdict).toBe("broken");
    expect(d.conversionTrust.signals.map((s) => s.id)).toContain("loop");
  });

  it("flags an implausibly high (but sub-100%) conversion rate as shaky", () => {
    const d = diagnoseAccount(raw({
      campaigns: [campaign({ clicks: 100, conv: 60, cost: 200 })], // 60%
      conversionActions: [
        convAction({ name: "Form", category: "SUBMIT_LEAD_FORM", counting: "MANY_PER_CLICK" }),
        convAction({ name: "Homepage view", category: "PAGE_VIEW" }),
      ],
    }));
    expect(d.conversionTrust.verdict).toBe("shaky");
    expect(d.conversionTrust.accountConvRatePct).toBe(60);
    const ids = d.conversionTrust.signals.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["high_rate", "counting", "page_view", "no_call"]));
  });

  it("marks a clean, call-tracked account as trustworthy", () => {
    const d = diagnoseAccount(raw({
      campaigns: [campaign({ clicks: 200, conv: 20, cost: 400 })], // 10%
      conversionActions: [convAction({ name: "Calls from ads", category: "PHONE_CALL_LEAD" })],
    }));
    expect(d.conversionTrust.verdict).toBe("trustworthy");
    expect(d.conversionTrust.accountConvRatePct).toBe(10);
    expect(d.conversionTrust.signals).toHaveLength(1);
    expect(d.conversionTrust.signals[0]!.id).toBe("ok");
  });

  it("tags conversion actions with the right flags", () => {
    const d = diagnoseAccount(raw({
      campaigns: [campaign({ clicks: 100, conv: 10 })],
      conversionActions: [
        convAction({ name: "Form", category: "SUBMIT_LEAD_FORM", counting: "MANY_PER_CLICK" }),
        convAction({ name: "Call", category: "PHONE_CALL_LEAD" }),
      ],
    }));
    const form = d.conversionTrust.actions.find((a) => a.name === "Form")!;
    const call = d.conversionTrust.actions.find((a) => a.name === "Call")!;
    expect(form.flags).toContain("counts every");
    expect(call.flags).toContain("call");
  });
});

describe("QS components", () => {
  it("lists only below-average keywords, sorted by spend, with correct summary", () => {
    const d = diagnoseAccount(raw({
      campaigns: [campaign({})],
      conversionActions: [convAction({ category: "PHONE_CALL_LEAD" })],
      keywords: [
        keyword({ kw: "emergency vet", cost: 50, adRelevance: "BELOW_AVERAGE", landingPage: "BELOW_AVERAGE" }),
        keyword({ kw: "vet near me", cost: 30, expectedCtr: "ABOVE_AVERAGE", adRelevance: "ABOVE_AVERAGE", landingPage: "ABOVE_AVERAGE" }),
        keyword({ kw: "cheap vet", cost: 70, expectedCtr: "BELOW_AVERAGE" }),
      ],
    }));
    expect(d.qsComponents.rows.map((r) => r.kw)).toEqual(["cheap vet", "emergency vet"]); // sorted by cost desc, above-avg excluded
    expect(d.qsComponents.summary).toEqual({
      belowExpectedCtr: 1,
      belowAdRelevance: 1,
      belowLandingPage: 1,
      totalScored: 3,
    });
  });
});

describe("auction insights", () => {
  it("passes through fetched competitor rows", () => {
    const auction: DiagAuction[] = [
      { domain: "rival-a.com", IS: 40, outranking: 30, overlap: 55, posAbove: 20, topOfPage: 60 },
      { domain: "rival-b.com", IS: 25, outranking: 50, overlap: 35, posAbove: 15, topOfPage: 45 },
    ];
    const d = diagnoseAccount(raw({ campaigns: [campaign({})], auction }));
    expect(d.auctionInsights.map((a) => a.domain)).toEqual(["rival-a.com", "rival-b.com"]);
    expect(d.auctionInsights[0]).toMatchObject({ impressionShare: 40, overlap: 55, outranking: 30 });
  });
});
