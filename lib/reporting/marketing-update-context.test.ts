import { describe, expect, it } from "vitest";
import {
  defaultMarketingUpdateGreeting,
  defaultMarketingUpdateTitle,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatDateRangeLabel,
} from "@/lib/reporting/marketing-update-format";
import {
  summarizeMarketingUpdateContext,
  type MarketingUpdateContext,
} from "@/lib/reporting/marketing-update-context";
import { buildMarketingUpdatePrompt } from "@/lib/reporting/marketing-update-prompt";

describe("marketing update formatters", () => {
  it("formats compact numbers like the Basecamp example", () => {
    expect(formatCompactNumber(148)).toBe("148");
    expect(formatCompactNumber(1120)).toBe("1.12K");
    expect(formatCompactNumber(463)).toBe("463");
  });

  it("formats ads spend from micros", () => {
    expect(formatCurrencyFromMicros(182_000_000)).toBe("$182");
    expect(formatCurrencyFromMicros(1_230_000)).toBe("$1.23");
  });

  it("formats date ranges for client-facing copy", () => {
    expect(formatDateRangeLabel("2026-04-01", "2026-05-14")).toBe("Apr 1 – May 14, 2026");
  });

  it("builds default title and greeting", () => {
    expect(defaultMarketingUpdateTitle(new Date("2026-05-15T12:00:00Z"))).toBe(
      "Marketing Updates Q2 2026",
    );
    expect(defaultMarketingUpdateGreeting("Barnes Animal Hospital")).toBe(
      "Hi Barnes Animal Hospital team,",
    );
  });
});

describe("marketing update prompt", () => {
  const baseContext: MarketingUpdateContext = {
    client: {
      id: 1,
      accountName: "Barnes Animal Hospital",
      marketingStrategist: "Daniel Gonzalez",
      websiteLabel: "barnesanimalhospital.com",
      activeServices: ["Google Ads", "Local Search Visibility"],
    },
    title: "Marketing Updates Q2 2026",
    greeting: "Hi Erika and Dr. Barnes,",
    window: {
      startDate: "2026-04-01",
      endDate: "2026-05-14",
      dateRangeLabel: "Apr 1 – May 14, 2026",
    },
    ads: {
      clicks: 148,
      impressions: 1120,
      averageCpcMicros: 1_230_000,
      costMicros: 182_000_000,
      conversions: 12,
      clicksLabel: "148",
      impressionsLabel: "1.12K",
      averageCpcLabel: "$1.23",
      costLabel: "$182",
      startDate: "2026-04-01",
      endDate: "2026-05-14",
      dateRangeLabel: "Apr 1 – May 14, 2026",
    },
    gbp: {
      totalInteractions: 463,
      phoneCalls: 199,
      directionRequests: 142,
      websiteClicks: 122,
      rating: 4.8,
      reviewCount: 120,
      recentReviews30d: 3,
      hasManualInteractions: true,
    },
    optionalChannels: [],
    workInProgressHints: ["Google Ads optimization — refining campaigns."],
    clientRequests: "Please send updated team photos.",
    nextMeetingUrl: "https://zoom.us/example",
    additionalNotes: null,
    channelsIncluded: ["Google Ads", "Google Business Profile"],
  };

  it("includes required section headings and exact metrics in the prompt", () => {
    const prompt = buildMarketingUpdatePrompt(baseContext);
    expect(prompt).toContain("WHAT'S NEW");
    expect(prompt).toContain("Google Ads Performance");
    expect(prompt).toContain("WHY IT MATTERS");
    expect(prompt).toContain("WHAT WE'RE WORKING ON");
    expect(prompt).toContain("NEXT STEPS");
    expect(prompt).toContain("463");
    expect(prompt).toContain("199");
    expect(prompt).toContain("148");
    expect(prompt).toContain("$1.23");
    expect(prompt).toContain("Hi Erika and Dr. Barnes,");
  });

  it("summarizes included channels for the API response", () => {
    const summary = summarizeMarketingUpdateContext(baseContext);
    expect(summary.hasAds).toBe(true);
    expect(summary.hasGbpManualInteractions).toBe(true);
    expect(summary.channelsIncluded).toEqual(["Google Ads", "Google Business Profile"]);
  });
});
