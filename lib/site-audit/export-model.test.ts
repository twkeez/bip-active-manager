import { describe, expect, it } from "vitest";
import { buildSiteAuditBrandedHtml } from "@/lib/site-audit/audit-brand-html";
import {
  buildSiteAuditExportModel,
  MAX_EXPORT_ISSUES_PER_TAB,
  scoreTone,
  siteAuditExportFilename,
} from "@/lib/site-audit/export-model";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";

function sampleRun(overrides: Partial<WebsiteAuditRun> = {}): WebsiteAuditRun {
  return {
    id: 1,
    owner_user_id: "user-1",
    input_url: "https://example-vet.com",
    normalized_url: "https://www.example-vet.com/",
    status: "completed",
    current_stage: "summary",
    stage_status: {},
    report_json: {
      crawl: {
        baseUrl: "https://www.example-vet.com/",
        crawledUrls: 12,
        pages: Array.from({ length: 20 }, (_, index) => ({
          url: `https://www.example-vet.com/page-${index}`,
          depth: index % 3,
          status: 200,
          title: `Page ${index}`,
          wordCount: 400 + index,
          schemaTypes: [],
        })),
        issues: [
          {
            rule_id: "missing-meta",
            severity: "critical",
            category: "onpage",
            title: "Missing meta description",
            description: "Homepage is missing a meta description.",
            suggestion: "Add a unique meta description.",
            url: "https://www.example-vet.com/",
          },
          {
            rule_id: "slow-lcp",
            severity: "watch",
            category: "performance",
            title: "Large contentful paint is slow",
            description: null,
            suggestion: "Optimize hero image.",
            url: null,
          },
        ],
      },
      lighthouse: {
        scores: {
          performance: 62,
          seo: 91,
          accessibility: 88,
          bestPractices: 79,
        },
        metrics: {
          fcp: "1.8 s",
          lcp: "3.4 s",
          cls: "0.08",
          tbt: "180 ms",
          speedIndex: "4.1 s",
        },
        findings: [],
      },
      summary: {
        markdown: "The site has solid SEO fundamentals but needs performance work.",
        wins: ["Strong title tags"],
        concerns: ["Slow LCP"],
        prioritizedFixes: ["Compress hero image", "Add homepage meta description"],
      },
      sitemap: {
        sitemapUrl: "https://www.example-vet.com/sitemap.xml",
        found: true,
        urlCount: 48,
        sampleUrls: ["https://www.example-vet.com/services"],
        error: null,
      },
    },
    created_at: "2026-06-09T12:00:00.000Z",
    updated_at: "2026-06-09T13:00:00.000Z",
    ...overrides,
  };
}

describe("buildSiteAuditExportModel", () => {
  it("builds score cards and grouped issues", () => {
    const model = buildSiteAuditExportModel(sampleRun());
    expect(model.scoreCards.some((card) => card.label === "Performance" && card.value === "62")).toBe(true);
    expect(model.issueSummary.critical).toBe(1);
    expect(model.issueSummary.high).toBe(1);
    expect(model.issuesByTab.seo.items.length).toBeGreaterThan(0);
    expect(model.summary?.prioritizedFixes).toHaveLength(2);
  });

  it("truncates long issue lists and page inventory", () => {
    const manyIssues = Array.from({ length: MAX_EXPORT_ISSUES_PER_TAB + 5 }, (_, index) => ({
      rule_id: `rule-${index}`,
      severity: "watch" as const,
      category: "onpage",
      title: `Issue ${index}`,
      description: null,
      suggestion: null,
      url: null,
    }));
    const model = buildSiteAuditExportModel(
      sampleRun({
        report_json: {
          crawl: {
            baseUrl: "https://www.example-vet.com/",
            crawledUrls: 40,
            pages: [],
            issues: manyIssues,
          },
        },
      }),
    );
    expect(model.issuesByTab.seo.items).toHaveLength(MAX_EXPORT_ISSUES_PER_TAB);
    expect(model.issuesByTab.seo.truncatedCount).toBe(5);
  });
});

describe("scoreTone", () => {
  it("maps lighthouse thresholds", () => {
    expect(scoreTone(95)).toBe("good");
    expect(scoreTone(70)).toBe("warn");
    expect(scoreTone(40)).toBe("bad");
  });
});

describe("siteAuditExportFilename", () => {
  it("builds a stable branded filename", () => {
    const model = buildSiteAuditExportModel(sampleRun());
    expect(siteAuditExportFilename(model)).toBe(
      "Beyond-Indigo-Site-Audit-www.example-vet.com-2026-06-09.pdf",
    );
  });
});

describe("buildSiteAuditBrandedHtml", () => {
  it("includes BI header and executive summary", () => {
    const html = buildSiteAuditBrandedHtml(buildSiteAuditExportModel(sampleRun()));
    expect(html).toContain("BEYOND INDIGO PETS");
    expect(html).toContain("Website SEO Audit");
    expect(html).toContain("solid SEO fundamentals");
  });
});
