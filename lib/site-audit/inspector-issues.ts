import type { AuditReportJson, LighthouseStageResult } from "@/lib/site-audit/types";
import type {
  GscSignal,
  LighthouseAuditItem,
  SeoCrawlIssue,
} from "@/lib/types/client";

export type InspectorTab = "seo" | "performance" | "code";
export type InspectorPriority = "critical" | "high" | "medium";

export type InspectorIssue = {
  id: string;
  tab: InspectorTab;
  title: string;
  description: string | null;
  priority: InspectorPriority;
  source: string;
  occurrenceKey?: string;
};

const PERFORMANCE_PATTERN =
  /lcp|fcp|cls|tbt|speed-index|render-blocking|largest-contentful|first-contentful|cumulative-layout|total-blocking|performance|vitals|lazy-load|efficient-cache|font-display|preload|mainthread|bootup-time|third-party|network-server|duplicated-javascript|legacy-javascript|unsized-images|uses-responsive-images|uses-optimized-images|offscreen-images|uses-text-compression|uses-rel-preconnect|server-response-time|redirects|interactive/i;

const CODE_PATTERN =
  /minify|unused-css|unused-javascript|unminified|valid-html|deprecations|charset|js-libraries|doctype|errors-in-console|inspector-issues|accessibility|best-practices|indexability|robots|canonical|hreflang|structured-data|schema|javascript|css|html|sliders|compress|byte/i;

export function categorizeInspectorIssue(input: {
  id: string;
  title: string;
  category?: string | null;
}): InspectorTab {
  const id = input.id.toLowerCase();
  const title = input.title.toLowerCase();
  const category = (input.category ?? "").toLowerCase();

  if (category === "performance" || PERFORMANCE_PATTERN.test(`${id} ${title}`)) {
    return "performance";
  }
  if (category === "onpage" || category === "crawl") {
    return "seo";
  }
  if (category === "indexability") {
    return "code";
  }
  if (CODE_PATTERN.test(`${id} ${title}`)) {
    if (/meta|title|heading|h1|description|content|ctr|query|keyword|canonical/i.test(title)) {
      return "seo";
    }
    return "code";
  }
  return "seo";
}

export function mapInspectorPriority(severity: "critical" | "watch"): InspectorPriority {
  return severity === "critical" ? "critical" : "high";
}

export function estimatePassedChecks(lighthouse?: LighthouseStageResult | null) {
  if (!lighthouse) return 0;
  return estimatePassedChecksFromScores(lighthouse.scores);
}

export function estimatePassedChecksFromScores(scores: {
  performance: number | null;
  seo: number | null;
  accessibility?: number | null;
  bestPractices?: number | null;
}) {
  const values = [
    scores.performance,
    scores.seo,
    scores.accessibility ?? null,
    scores.bestPractices ?? null,
  ].filter((score): score is number => score != null);
  if (values.length === 0) return 0;
  return values.reduce((sum, score) => sum + Math.round((score / 100) * 8), 0);
}

function allocateUniqueId(base: string, seen: Map<string, number>) {
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}--${count + 1}`;
}

export function buildInspectorIssuesFromReport(report: AuditReportJson): InspectorIssue[] {
  const issues: InspectorIssue[] = [];
  const seenIds = new Map<string, number>();

  for (const issue of report.technical_seo?.homepageIssues ?? []) {
    issues.push({
      id: allocateUniqueId(`technical-seo-${issue.id}`, seenIds),
      tab: categorizeInspectorIssue({ id: issue.id, title: issue.title }),
      title: issue.title,
      description: issue.recommendation || issue.description,
      priority: mapInspectorPriority(issue.severity),
      source: "Technical SEO",
    });
  }

  for (const issue of report.crawl?.issues ?? []) {
    issues.push({
      id: allocateUniqueId(`crawl-${issue.rule_id}-${issue.url ?? "site"}`, seenIds),
      tab: categorizeInspectorIssue({
        id: issue.rule_id,
        title: issue.title,
        category: issue.category,
      }),
      title: issue.title,
      description: issue.suggestion || issue.description || issue.url,
      priority: mapInspectorPriority(issue.severity),
      source: "Crawl",
    });
  }

  for (const finding of report.lighthouse?.findings ?? []) {
    issues.push({
      id: allocateUniqueId(`lighthouse-${finding.id}`, seenIds),
      tab: categorizeInspectorIssue({ id: finding.id, title: finding.title }),
      title: finding.title,
      description: finding.display_value || finding.description,
      priority: mapInspectorPriority(finding.severity),
      source: "Lighthouse",
    });
  }

  for (const [index, recommendation] of (report.schema?.recommendations ?? []).entries()) {
    issues.push({
      id: allocateUniqueId(`schema-rec-${index}`, seenIds),
      tab: "code",
      title: recommendation,
      description: "Structured data recommendation from schema audit.",
      priority: "medium",
      source: "Schema",
    });
  }

  return issues;
}

export function buildClientSeoInspectorIssues(input: {
  lighthouseItems: LighthouseAuditItem[];
  crawlIssues: SeoCrawlIssue[];
  gscSignals: GscSignal[];
}): InspectorIssue[] {
  const issues: InspectorIssue[] = [];

  for (const item of input.lighthouseItems) {
    issues.push({
      id: `lh-${item.id}`,
      tab: categorizeInspectorIssue({ id: item.id, title: item.title }),
      title: item.title,
      description: item.description || item.display_value,
      priority: mapInspectorPriority(item.severity),
      source: "Lighthouse",
      occurrenceKey: item.occurrences[0]?.occurrence_key ?? `${item.id}::__audit_level`,
    });
  }

  for (const issue of input.crawlIssues) {
    issues.push({
      id: `crawl-${issue.id}`,
      tab: categorizeInspectorIssue({
        id: issue.rule_id,
        title: issue.title,
        category: issue.category,
      }),
      title: issue.title,
      description: issue.suggestion || issue.description || issue.url,
      priority: mapInspectorPriority(issue.severity),
      source: "Crawl",
      occurrenceKey: issue.occurrence_key,
    });
  }

  for (const signal of input.gscSignals) {
    issues.push({
      id: `gsc-${signal.id}`,
      tab: "seo",
      title: signal.title,
      description: signal.metric_value || signal.suggestion || signal.description,
      priority: mapInspectorPriority(signal.severity),
      source: "Search Console",
      occurrenceKey: signal.occurrence_key,
    });
  }

  return issues;
}

export function summarizeInspectorIssues(issues: InspectorIssue[], passedChecks = 0) {
  const critical = issues.filter((issue) => issue.priority === "critical").length;
  const high = issues.filter((issue) => issue.priority === "high").length;
  const mediumLow = issues.filter((issue) => issue.priority === "medium").length;
  return { critical, high, mediumLow, passed: passedChecks };
}
