import { describe, expect, it } from "vitest";
import { buildGoogleAdsUiUrl, formatGoogleAdsCustomerId } from "@/lib/ads/google-ads-ui-links";

describe("google-ads-ui-links", () => {
  it("formats customer ids for display", () => {
    expect(formatGoogleAdsCustomerId("1234567890")).toBe("123-456-7890");
    expect(formatGoogleAdsCustomerId("123-456-7890")).toBe("123-456-7890");
  });

  it("builds account-scoped Google Ads URLs by issue type", () => {
    expect(
      buildGoogleAdsUiUrl({
        adsCustomerId: "1234567890",
        issueType: "budget_capped",
      }),
    ).toBe("https://ads.google.com/aw/campaigns?__e=1234567890");

    expect(
      buildGoogleAdsUiUrl({
        adsCustomerId: "1234567890",
        issueType: "ad_relevance",
        campaignId: "99",
        adGroupId: "55",
      }),
    ).toBe("https://ads.google.com/aw/ads?__e=1234567890&campaignId=99&adGroupId=55");
  });

  it("returns null when customer id is invalid", () => {
    expect(
      buildGoogleAdsUiUrl({
        adsCustomerId: "123",
        issueType: "expected_ctr",
      }),
    ).toBeNull();
  });
});
