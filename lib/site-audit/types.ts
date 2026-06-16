export const AUDIT_STAGES = [
  "discovery",
  "sitemap",
  "crawl",
  "schema",
  "technical_seo",
  "lighthouse",
  "keywords",
  "summary",
] as const;

export type AuditStage = (typeof AUDIT_STAGES)[number];

export type AuditRunStatus = "pending" | "running" | "completed" | "failed" | "partial";

export type StageRunStatus = "pending" | "running" | "done" | "failed";

export type StageStatusMap = Partial<
  Record<
    AuditStage,
    {
      status: StageRunStatus;
      startedAt?: string | null;
      finishedAt?: string | null;
      error?: string | null;
    }
  >
>;

export type DiscoveryStageResult = {
  normalizedUrl: string;
  finalUrl: string;
  httpStatus: number;
  robotsTxt: {
    found: boolean;
    allowsAll: boolean | null;
    sitemapHints: string[];
    summary: string;
  };
  homepage: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    canonical: string | null;
  };
};

export type SitemapStageResult = {
  sitemapUrl: string;
  found: boolean;
  urlCount: number;
  sampleUrls: string[];
  error: string | null;
};

export type CrawlPageRecord = {
  url: string;
  depth: number;
  status: number;
  title: string | null;
  wordCount: number;
  schemaTypes: string[];
};

export type CrawlStageResult = {
  baseUrl: string;
  crawledUrls: number;
  pages: CrawlPageRecord[];
  issues: Array<{
    rule_id: string;
    severity: "critical" | "watch";
    category: string;
    title: string;
    description: string | null;
    suggestion: string | null;
    url: string | null;
  }>;
};

export type SchemaStageResult = {
  pagesWithSchema: number;
  allTypes: string[];
  byPage: Array<{ url: string; types: string[] }>;
  recommendations: string[];
};

export type TechnicalSeoStageResult = {
  homepageIssues: Array<{
    id: string;
    severity: "critical" | "watch";
    title: string;
    description: string;
    recommendation: string;
  }>;
  crawlIssueCount: { critical: number; watch: number };
};

export type LighthouseStageResult = {
  url: string;
  fetchedAt: string;
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  metrics: {
    fcp: string | null;
    lcp: string | null;
    cls: string | null;
    tbt: string | null;
    speedIndex: string | null;
  };
  findings: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: "critical" | "watch";
    display_value: string | null;
  }>;
};

export type KeywordsStageResult = {
  source: "gsc" | "ai";
  label: string;
  gscPropertyUrl?: string | null;
  dateRange?: { start: string; end: string };
  topQueries?: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages?: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  aiKeywords?: Array<{
    keyword: string;
    alignment: "strong" | "moderate" | "weak";
    evidence: string;
  }>;
  gaps?: string[];
};

export type SummaryStageResult = {
  markdown: string;
  wins: string[];
  concerns: string[];
  prioritizedFixes: string[];
};

export type AuditReportJson = {
  discovery?: DiscoveryStageResult;
  sitemap?: SitemapStageResult;
  crawl?: CrawlStageResult;
  schema?: SchemaStageResult;
  technical_seo?: TechnicalSeoStageResult;
  lighthouse?: LighthouseStageResult;
  keywords?: KeywordsStageResult;
  summary?: SummaryStageResult;
};

export type WebsiteAuditRun = {
  id: number;
  owner_user_id: string;
  input_url: string;
  normalized_url: string | null;
  status: AuditRunStatus;
  current_stage: string | null;
  stage_status: StageStatusMap;
  report_json: AuditReportJson;
  created_at: string;
  updated_at: string;
};
