import {
  buildInspectorIssuesFromReport,
  estimatePassedChecks,
  summarizeInspectorIssues,
  type InspectorIssue,
  type InspectorTab,
} from "@/lib/site-audit/inspector-issues";
import type { AuditReportJson, CrawlPageRecord, WebsiteAuditRun } from "@/lib/site-audit/types";

export const INSPECTOR_TAB_LABELS: Record<InspectorTab, string> = {
  seo: "Content & On-Page SEO",
  performance: "Performance & Vitals",
  code: "Code Optimization",
};

export const MAX_EXPORT_ISSUES_PER_TAB = 25;
export const MAX_APPENDIX_PAGES = 12;

const PRIORITY_ORDER: Record<InspectorIssue["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

export type ScoreTone = "good" | "warn" | "bad" | "neutral";

export type SiteAuditScoreCard = {
  label: string;
  value: string;
  tone: ScoreTone;
};

export type SiteAuditExportModel = {
  siteUrl: string;
  normalizedUrl: string | null;
  generatedAt: string;
  formattedDate: string;
  status: string;
  scoreCards: SiteAuditScoreCard[];
  issueSummary: ReturnType<typeof summarizeInspectorIssues>;
  issuesByTab: Record<
    InspectorTab,
    { items: InspectorIssue[]; truncatedCount: number }
  >;
  summary: AuditReportJson["summary"] | null;
  lighthouseMetrics: {
    fcp: string;
    lcp: string;
    cls: string;
    tbt: string;
    speedIndex: string;
  } | null;
  sitemap: {
    url: string;
    found: boolean;
    urlCount: number;
    sampleUrls: string[];
  } | null;
  schema: {
    pagesWithSchema: number;
    types: string[];
    recommendations: string[];
  } | null;
  topPages: CrawlPageRecord[];
  totalPagesCrawled: number;
  keywordsLabel: string | null;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  keywordGaps: string[];
};

export function formatAuditScore(value: number | null | undefined): string {
  return value == null ? "—" : `${value}`;
}

export function scoreTone(value: number | null | undefined): ScoreTone {
  if (value == null) return "neutral";
  if (value >= 90) return "good";
  if (value >= 50) return "warn";
  return "bad";
}

function sortIssues(issues: InspectorIssue[]): InspectorIssue[] {
  return [...issues].sort((left, right) => {
    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return left.title.localeCompare(right.title);
  });
}

function groupIssuesByTab(issues: InspectorIssue[]) {
  const grouped: Record<InspectorTab, InspectorIssue[]> = {
    seo: [],
    performance: [],
    code: [],
  };
  for (const issue of sortIssues(issues)) {
    grouped[issue.tab].push(issue);
  }

  return {
    seo: sliceIssues(grouped.seo),
    performance: sliceIssues(grouped.performance),
    code: sliceIssues(grouped.code),
  } satisfies SiteAuditExportModel["issuesByTab"];
}

function sliceIssues(issues: InspectorIssue[]) {
  if (issues.length <= MAX_EXPORT_ISSUES_PER_TAB) {
    return { items: issues, truncatedCount: 0 };
  }
  return {
    items: issues.slice(0, MAX_EXPORT_ISSUES_PER_TAB),
    truncatedCount: issues.length - MAX_EXPORT_ISSUES_PER_TAB,
  };
}

function formatDisplayDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildSiteAuditExportModel(run: WebsiteAuditRun): SiteAuditExportModel {
  const report = run.report_json;
  const issues = buildInspectorIssuesFromReport(report);
  const passedChecks = estimatePassedChecks(report.lighthouse);
  const issueSummary = summarizeInspectorIssues(issues, passedChecks);

  const scoreCards: SiteAuditScoreCard[] = [
    {
      label: "Critical issues",
      value: `${issueSummary.critical}`,
      tone: issueSummary.critical > 0 ? "bad" : "good",
    },
    {
      label: "High priority",
      value: `${issueSummary.high}`,
      tone: issueSummary.high > 0 ? "warn" : "good",
    },
    {
      label: "Pages crawled",
      value: `${report.crawl?.crawledUrls ?? 0}`,
      tone: "neutral",
    },
    {
      label: "Sitemap URLs",
      value: `${report.sitemap?.urlCount ?? 0}`,
      tone: "neutral",
    },
  ];

  if (report.lighthouse) {
    scoreCards.unshift(
      {
        label: "Performance",
        value: formatAuditScore(report.lighthouse.scores.performance),
        tone: scoreTone(report.lighthouse.scores.performance),
      },
      {
        label: "SEO",
        value: formatAuditScore(report.lighthouse.scores.seo),
        tone: scoreTone(report.lighthouse.scores.seo),
      },
      {
        label: "Accessibility",
        value: formatAuditScore(report.lighthouse.scores.accessibility),
        tone: scoreTone(report.lighthouse.scores.accessibility),
      },
      {
        label: "Best practices",
        value: formatAuditScore(report.lighthouse.scores.bestPractices),
        tone: scoreTone(report.lighthouse.scores.bestPractices),
      },
    );
  }

  const pages = report.crawl?.pages ?? [];

  return {
    siteUrl: run.input_url,
    normalizedUrl: run.normalized_url,
    generatedAt: run.updated_at,
    formattedDate: formatDisplayDate(run.updated_at),
    status: run.status,
    scoreCards,
    issueSummary,
    issuesByTab: groupIssuesByTab(issues),
    summary: report.summary ?? null,
    lighthouseMetrics: report.lighthouse
      ? {
          fcp: report.lighthouse.metrics.fcp ?? "—",
          lcp: report.lighthouse.metrics.lcp ?? "—",
          cls: report.lighthouse.metrics.cls ?? "—",
          tbt: report.lighthouse.metrics.tbt ?? "—",
          speedIndex: report.lighthouse.metrics.speedIndex ?? "—",
        }
      : null,
    sitemap: report.sitemap
      ? {
          url: report.sitemap.sitemapUrl,
          found: report.sitemap.found,
          urlCount: report.sitemap.urlCount,
          sampleUrls: report.sitemap.sampleUrls.slice(0, 8),
        }
      : null,
    schema: report.schema
      ? {
          pagesWithSchema: report.schema.pagesWithSchema,
          types: report.schema.allTypes,
          recommendations: report.schema.recommendations.slice(0, 8),
        }
      : null,
    topPages: pages.slice(0, MAX_APPENDIX_PAGES),
    totalPagesCrawled: report.crawl?.crawledUrls ?? pages.length,
    keywordsLabel: report.keywords?.label ?? null,
    topQueries: (report.keywords?.topQueries ?? []).slice(0, 10),
    keywordGaps: (report.keywords?.gaps ?? []).slice(0, 8),
  };
}

export function siteAuditExportFilename(model: SiteAuditExportModel): string {
  const host = model.normalizedUrl ?? model.siteUrl;
  const slug = host
    .replace(/^https?:\/\//, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const date = model.generatedAt.slice(0, 10);
  return `Beyond-Indigo-Site-Audit-${slug || "site"}-${date}.pdf`;
}
