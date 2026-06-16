import { beforeEach, describe, expect, it, vi } from "vitest";
import { runStrategyMapperWebsiteAudit } from "@/lib/strategy-mapper/website-seo-audit";
import type { StrategyMapperFormData, StrategyMapperResearch } from "@/types/strategy-mapper";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";

vi.mock("@/lib/sales/audit", () => ({
  runSalesSeoAudit: vi.fn(async () => ({
    normalized_url: "https://example.com/",
    title: "Example Vet",
    title_length: 11,
    meta_description: "Local vet clinic",
    meta_description_length: 16,
    h1_count: 0,
    canonical: null,
    robots_meta: null,
    has_json_ld_schema: false,
    schema_types: [],
    has_sitemap_hint: false,
    has_robots_txt_hint: false,
    issues: [
      {
        id: "missing-h1",
        severity: "critical",
        title: "Missing H1",
        description: "No H1 heading was detected.",
        recommendation: "Add one clear H1.",
      },
    ],
  })),
}));

vi.mock("@/lib/seo/crawl", () => ({
  runQuickSeoCrawl: vi.fn(async () => ({
    baseUrl: "https://example.com/",
    crawledUrls: 3,
    issues: [
      {
        rule_id: "missing-meta-description",
        severity: "watch",
        category: "onpage",
        title: "Missing meta description",
        description: "Page lacks meta description",
        suggestion: "Add meta description",
        url: "https://example.com/about",
        location: null,
        evidence: null,
        occurrence_key: "missing-meta-description::https://example.com/about",
      },
    ],
  })),
}));

vi.mock("@/lib/sales/lighthouse", () => ({
  runSalesLighthouseAudit: vi.fn(async () => ({
    url: "https://example.com/",
    fetchedAt: new Date().toISOString(),
    scores: {
      performance: 55,
      seo: 72,
      accessibility: 88,
      bestPractices: 90,
    },
    metrics: {
      fcp: "1.2 s",
      lcp: "2.4 s",
      cls: "0.05",
      tbt: "120 ms",
      speedIndex: "2.8 s",
    },
    findings: [
      {
        id: "document-title",
        title: "Document does not have a title element",
        description: "Title missing",
        display_value: null,
        score: 0,
        severity: "critical" as const,
      },
    ],
  })),
}));

vi.mock("@/lib/strategy-mapper/keyword-alignment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/strategy-mapper/keyword-alignment")>();
  return {
    ...actual,
    runAiKeywordGapAnalysis: vi.fn(async () => null),
  };
});

const baseForm: StrategyMapperFormData = {
  practiceName: "Example Vet",
  practiceOwnerName: "",
  streetAddress: "123 Main St, Howell, NJ",
  locationNotes: "",
  specializations: ["Small Animal"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  siteContext: "existing_active",
  strategicContextNotes: "",
  websiteUrl: "https://example.com",
};

const research: StrategyMapperResearch = {
  densityTier: "suburban",
  wellnessRadiusMiles: 5,
  specialtyRadiusMiles: null,
  specialtyRadiusEnabled: false,
  radiusRationale: "Suburban default",
  clientMetrics: { googleRating: 4.2, reviewCount: 100, runsGoogleAds: false },
  competitors: [],
};

describe("runStrategyMapperWebsiteAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses fix_now audit mode for existing active sites", async () => {
    const radius = calculateDualRadius(baseForm);
    const result = await runStrategyMapperWebsiteAudit({
      form: baseForm,
      research,
      radius,
      activeServices: ["seo"],
      contentBlocks: [],
    });

    expect(result.auditMode).toBe("fix_now");
    expect(result.skipped).toBeUndefined();
    expect(result.homepage.h1Count).toBe(0);
    expect(result.homepage.issues.some((issue) => issue.id === "missing-h1")).toBe(true);
    expect(result.crawl.pagesScanned).toBe(3);
    expect(result.lighthouse?.scores.seo).toBe(72);
    expect(result.redFlagSummary.some((item) => item.includes("Missing H1"))).toBe(true);
  });

  it("uses pre_launch_baseline for external builder launches", async () => {
    const radius = calculateDualRadius(baseForm);
    const result = await runStrategyMapperWebsiteAudit({
      form: { ...baseForm, siteContext: "launching_external_builder" },
      research,
      radius,
      activeServices: ["seo"],
      contentBlocks: [],
    });

    expect(result.auditMode).toBe("pre_launch_baseline");
  });

  it("skips audit when no URL and not required", async () => {
    const radius = calculateDualRadius(baseForm);
    const result = await runStrategyMapperWebsiteAudit({
      form: {
        ...baseForm,
        siteContext: "brand_new_ground_up",
        websiteUrl: undefined,
      },
      research,
      radius,
      activeServices: ["seo"],
      contentBlocks: [],
    });

    expect(result.skipped).toBe(true);
    expect(result.redFlagSummary[0]).toContain("skipped");
  });

  it("throws when URL is required but missing", async () => {
    const radius = calculateDualRadius(baseForm);
    await expect(
      runStrategyMapperWebsiteAudit({
        form: { ...baseForm, websiteUrl: "" },
        research,
        radius,
        activeServices: ["seo"],
        contentBlocks: [],
      }),
    ).rejects.toThrow(/required/i);
  });
});
