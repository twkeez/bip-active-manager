import {
  assembleKeywordMatrix,
  type ContentBlockTemplate,
  type ContentPlaceholderContext,
} from "@/lib/strategy-mapper/content-library";
import {
  normalizeWebsiteUrl,
  resolveSiteContext,
  websiteUrlRequiredForSiteContext,
} from "@/lib/strategy-mapper/form-options";
import {
  buildDeterministicKeywordCoverage,
  runAiKeywordGapAnalysis,
} from "@/lib/strategy-mapper/keyword-alignment";
import { runSalesSeoAudit } from "@/lib/sales/audit";
import { runSalesLighthouseAudit } from "@/lib/sales/lighthouse";
import { runQuickSeoCrawl, type CrawlIssue } from "@/lib/seo/crawl";
import type { DualRadiusResult } from "@/types/strategy-mapper";
import type {
  SiteContext,
  StrategyMapperFormData,
  StrategyMapperResearch,
  StrategyMapperService,
  WebsiteSeoAuditIssue,
  WebsiteSeoAuditMode,
  WebsiteSeoAuditResult,
} from "@/types/strategy-mapper";

const SEO_LIGHTHOUSE_IDS = new Set([
  "document-title",
  "meta-description",
  "link-text",
  "crawlable-anchors",
  "is-crawlable",
  "robots-txt",
  "hreflang",
  "canonical",
  "structured-data",
]);

function resolveAuditMode(siteContext: SiteContext): WebsiteSeoAuditMode {
  return siteContext === "existing_active" ? "fix_now" : "pre_launch_baseline";
}

function mapHomepageIssue(issue: {
  id: string;
  severity: "critical" | "watch";
  title: string;
  description: string;
  recommendation?: string;
}): WebsiteSeoAuditIssue {
  return {
    id: issue.id,
    severity: issue.severity,
    title: issue.title,
    description: issue.description,
    recommendation: issue.recommendation,
  };
}

function mapCrawlIssue(issue: CrawlIssue): WebsiteSeoAuditIssue {
  return {
    id: issue.rule_id,
    severity: issue.severity,
    title: issue.title,
    description: issue.description ?? issue.title,
    recommendation: issue.suggestion ?? undefined,
    url: issue.url,
  };
}

function mapLighthouseFinding(finding: {
  id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
}): WebsiteSeoAuditIssue {
  return {
    id: finding.id,
    severity: finding.severity,
    title: finding.title,
    description: finding.description ?? finding.title,
  };
}

function buildRedFlagSummary(input: {
  homepageIssues: WebsiteSeoAuditIssue[];
  crawlIssues: WebsiteSeoAuditIssue[];
  lighthouseBlockers: WebsiteSeoAuditIssue[];
  keywordGaps: string[];
  auditMode: WebsiteSeoAuditMode;
}): string[] {
  const bullets: string[] = [];

  for (const issue of input.homepageIssues.filter((row) => row.severity === "critical")) {
    bullets.push(`Homepage: ${issue.title}`);
  }
  for (const issue of input.crawlIssues.filter((row) => row.severity === "critical").slice(0, 3)) {
    bullets.push(`Crawl: ${issue.title}${issue.url ? ` (${issue.url})` : ""}`);
  }
  for (const issue of input.lighthouseBlockers.slice(0, 2)) {
    bullets.push(`Lighthouse SEO: ${issue.title}`);
  }
  for (const gap of input.keywordGaps.slice(0, 3)) {
    bullets.push(`Keyword coverage gap: "${gap}" not detected on key pages`);
  }

  if (bullets.length === 0) {
    const watchCount =
      input.homepageIssues.filter((row) => row.severity === "watch").length +
      input.crawlIssues.filter((row) => row.severity === "watch").length;
    if (watchCount > 0) {
      bullets.push(`${watchCount} watch-level on-page issues detected — review before launch.`);
    } else {
      bullets.push(
        input.auditMode === "fix_now"
          ? "No critical homepage or crawl blockers detected — continue Phase 1 keyword mapping."
          : "Baseline audit shows no critical blockers — carry findings into launch SEO blueprint.",
      );
    }
  }

  return bullets.slice(0, 8);
}

function buildSkippedResult(siteContext: SiteContext): WebsiteSeoAuditResult {
  return {
    url: "",
    finalUrl: "",
    auditMode: resolveAuditMode(siteContext),
    skipped: true,
    homepage: {
      title: null,
      metaDescription: null,
      h1Count: 0,
      canonical: null,
      issues: [],
    },
    crawl: {
      pagesScanned: 0,
      issueCount: 0,
      topIssues: [],
    },
    keywordAlignment: {
      matrixRows: [],
      coverage: [],
      gaps: [],
    },
    redFlagSummary: ["Website audit skipped — no current URL provided."],
  };
}

export interface RunWebsiteSeoAuditInput {
  form: StrategyMapperFormData;
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
  contentBlocks: ContentBlockTemplate[];
}

export async function runStrategyMapperWebsiteAudit(
  input: RunWebsiteSeoAuditInput,
): Promise<WebsiteSeoAuditResult> {
  const siteContext = resolveSiteContext(input.form);
  const auditMode = resolveAuditMode(siteContext);
  const normalizedUrl = normalizeWebsiteUrl(input.form.websiteUrl ?? "");

  if (!normalizedUrl) {
    if (websiteUrlRequiredForSiteContext(siteContext)) {
      throw new Error("Website URL is required for this site context.");
    }
    return buildSkippedResult(siteContext);
  }

  const homepageAudit = await runSalesSeoAudit(normalizedUrl);
  const crawlResult = await runQuickSeoCrawl(normalizedUrl, 15);

  let lighthouse:
    | {
        scores: {
          performance: number | null;
          seo: number | null;
          accessibility: number | null;
          bestPractices: number | null;
        };
        seoBlockers: WebsiteSeoAuditIssue[];
      }
    | undefined;

  try {
    const lighthouseResult = await runSalesLighthouseAudit(normalizedUrl);
    const seoBlockers = lighthouseResult.findings
      .filter(
        (finding) =>
          SEO_LIGHTHOUSE_IDS.has(finding.id) ||
          finding.id.startsWith("meta-") ||
          finding.id.includes("seo"),
      )
      .map(mapLighthouseFinding);

    lighthouse = {
      scores: lighthouseResult.scores,
      seoBlockers,
    };
  } catch {
    lighthouse = undefined;
  }

  const contentContext: ContentPlaceholderContext = {
    form: input.form,
    radius: input.radius,
    research: input.research,
    activeServices: input.activeServices,
  };

  const matrixRows = input.activeServices.includes("seo")
    ? assembleKeywordMatrix(input.contentBlocks, contentContext)
    : [];

  const crawlTopIssues = crawlResult.issues
    .slice()
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "critical" ? -1 : 1;
      }
      return 0;
    })
    .slice(0, 12)
    .map(mapCrawlIssue);

  const pageSummaries = crawlResult.issues
    .reduce<Array<{ url: string; title: string | null }>>((acc, issue) => {
      if (!issue.url || acc.some((row) => row.url === issue.url)) return acc;
      acc.push({ url: issue.url, title: issue.title });
      return acc;
    }, [])
    .slice(0, 10);

  if (pageSummaries.length === 0) {
    pageSummaries.push({
      url: homepageAudit.normalized_url,
      title: homepageAudit.title,
    });
  }

  const surfaces = [
    {
      label: "Homepage title",
      text: homepageAudit.title ?? "",
    },
    {
      label: "Homepage meta description",
      text: homepageAudit.meta_description ?? "",
    },
    ...pageSummaries.slice(0, 5).map((page, index) => ({
      label: `Page ${index + 1} title (${page.url})`,
      text: page.title ?? "",
    })),
  ];

  const deterministic = buildDeterministicKeywordCoverage(matrixRows, surfaces);
  const aiKeyword = await runAiKeywordGapAnalysis({
    matrix: matrixRows,
    pageSummaries,
    coverage: deterministic.coverage,
    gaps: deterministic.gaps,
  });

  const keywordGaps = aiKeyword?.gaps ?? deterministic.gaps;
  const homepageIssues = homepageAudit.issues.map(mapHomepageIssue);

  const redFlagSummary = buildRedFlagSummary({
    homepageIssues,
    crawlIssues: crawlTopIssues,
    lighthouseBlockers: lighthouse?.seoBlockers ?? [],
    keywordGaps,
    auditMode,
  });

  return {
    url: normalizedUrl,
    finalUrl: homepageAudit.normalized_url,
    auditMode,
    homepage: {
      title: homepageAudit.title,
      metaDescription: homepageAudit.meta_description,
      h1Count: homepageAudit.h1_count,
      canonical: homepageAudit.canonical,
      issues: homepageIssues,
    },
    crawl: {
      pagesScanned: crawlResult.crawledUrls,
      issueCount: crawlResult.issues.length,
      topIssues: crawlTopIssues,
    },
    lighthouse,
    keywordAlignment: {
      matrixRows,
      coverage: deterministic.coverage,
      gaps: keywordGaps,
      aiSummary: aiKeyword?.aiSummary,
    },
    redFlagSummary,
  };
}
