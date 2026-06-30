import { describe, expect, it } from "vitest";
import { buildTemplateFromReport } from "@/lib/site-audit/seo-audit-template";
import type { AuditReportJson } from "@/lib/site-audit/types";

const OPTS = {
  client: "Happy Paws Vet",
  website: "https://happypaws.example",
  auditDate: "2026-06-30",
  preparedBy: "Tom",
};

function ratingFor(report: AuditReportJson, sectionId: string, itemKey: string) {
  const data = buildTemplateFromReport(report, OPTS);
  const section = data.ratedSections.find((s) => s.id === sectionId);
  return section?.items.find((i) => i.key === itemKey)?.rating;
}

describe("buildTemplateFromReport — critical issues", () => {
  it("rates SSL critical when the final URL is not https", () => {
    const report: AuditReportJson = {
      discovery: {
        normalizedUrl: "http://happypaws.example",
        finalUrl: "http://happypaws.example",
        httpStatus: 200,
        robotsTxt: { found: true, allowsAll: true, sitemapHints: [], summary: "" },
        homepage: { title: "x", metaDescription: "y", h1Count: 1, canonical: null },
      },
    };
    expect(ratingFor(report, "critical_issues", "ssl_https")).toBe("critical");
  });

  it("rates SSL good over https", () => {
    const report: AuditReportJson = {
      discovery: {
        normalizedUrl: "https://happypaws.example",
        finalUrl: "https://happypaws.example",
        httpStatus: 200,
        robotsTxt: { found: true, allowsAll: true, sitemapHints: [], summary: "" },
        homepage: { title: "x", metaDescription: "y", h1Count: 1, canonical: null },
      },
    };
    expect(ratingFor(report, "critical_issues", "ssl_https")).toBe("good");
  });

  it("escalates broken links by 404 count", () => {
    const pages = [200, 404, 404, 500].map((status, i) => ({
      url: `https://happypaws.example/p${i}`,
      depth: 1,
      status,
      title: null,
      wordCount: 0,
      schemaTypes: [],
    }));
    const report: AuditReportJson = {
      crawl: { baseUrl: "https://happypaws.example", crawledUrls: 4, pages, issues: [] },
    };
    expect(ratingFor(report, "critical_issues", "broken_links")).toBe("critical");
  });

  it("leaves items unrated (null) when no crawl/discovery ran", () => {
    expect(ratingFor({}, "critical_issues", "broken_links")).toBeNull();
    expect(ratingFor({}, "critical_issues", "ssl_https")).toBeNull();
  });
});

describe("buildTemplateFromReport — performance", () => {
  const reportWithPerf = (performance: number): AuditReportJson => ({
    lighthouse: {
      url: "https://happypaws.example",
      fetchedAt: "2026-06-30",
      scores: { performance, seo: 90, accessibility: 90, bestPractices: 90 },
      metrics: { fcp: "1s", lcp: "2s", cls: "0.01", tbt: "100ms", speedIndex: "2s" },
      findings: [],
    },
  });

  it("maps a high performance score to good", () => {
    expect(ratingFor(reportWithPerf(95), "performance", "mobile_speed")).toBe("good");
  });
  it("maps a mid score to needs_work", () => {
    expect(ratingFor(reportWithPerf(60), "performance", "mobile_speed")).toBe("needs_work");
  });
  it("maps a low score to critical", () => {
    expect(ratingFor(reportWithPerf(30), "performance", "mobile_speed")).toBe("critical");
  });
  it("always leaves desktop speed manual", () => {
    expect(ratingFor(reportWithPerf(95), "performance", "desktop_speed")).toBeNull();
  });
});

describe("buildTemplateFromReport — technical & local", () => {
  it("rates a missing sitemap critical", () => {
    const report: AuditReportJson = {
      sitemap: { sitemapUrl: "", found: false, urlCount: 0, sampleUrls: [], error: null },
    };
    expect(ratingFor(report, "technical", "xml_sitemap")).toBe("critical");
  });

  it("rates a present sitemap with URLs good", () => {
    const report: AuditReportJson = {
      sitemap: { sitemapUrl: "x", found: true, urlCount: 42, sampleUrls: [], error: null },
    };
    expect(ratingFor(report, "technical", "xml_sitemap")).toBe("good");
  });

  it("always leaves local SEO items manual", () => {
    const data = buildTemplateFromReport({}, OPTS);
    const local = data.ratedSections.find((s) => s.id === "local_trust");
    expect(local?.items.every((i) => i.rating === null)).toBe(true);
  });
});

describe("buildTemplateFromReport — keywords & meta", () => {
  it("pulls target keywords from GSC top queries", () => {
    const report: AuditReportJson = {
      keywords: {
        source: "gsc",
        label: "GSC",
        topQueries: [
          { query: "vet near me", clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
          { query: "dog dental", clicks: 5, impressions: 80, ctr: 0.06, position: 7 },
        ],
      },
    };
    const data = buildTemplateFromReport(report, OPTS);
    expect(data.keywords.targetKeywords).toContain("vet near me");
    expect(data.meta.client).toBe("Happy Paws Vet");
  });
});
