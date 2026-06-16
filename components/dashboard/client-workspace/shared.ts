import { buildBaselineTechnicalFindings } from "@/lib/reporting/build-report";
import type { ClientRow, LighthouseSnapshot, SitemapSnapshot } from "@/lib/types/client";

export type TechnicalChannel = "seo" | "ads" | "sitemaps" | "social";
export type TechnicalFilter = "" | "critical" | "ads_issues" | TechnicalChannel;
export type FindingSeverity = "critical" | "watch";
export type FindingStatus = "open" | "acknowledged" | "in_progress" | "resolved";

export type TechnicalFinding = {
  id: string;
  channel: TechnicalChannel;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  confidence: "high" | "medium";
  impact: "high" | "medium";
  detectedAt: string;
  dueLabel: string;
};

export type TechnicalSummary = {
  health: "Good" | "Watch" | "Critical";
  openCount: number;
  hasCritical: boolean;
  findings: TechnicalFinding[];
};

export type ChannelMetric = {
  label: string;
  value: string;
  source?: "internal" | "lighthouse" | "crawl" | "gsc";
  definition?: string;
  updatedAt?: string | null;
};

export type HelpdeskTicketSelection = {
  itemId: string;
  source: "lighthouse" | "crawl" | "gsc";
  title: string;
  description: string | null;
  suggestion: string | null;
  location: string | null;
  evidence: string | null;
  severity: "critical" | "watch";
};

export type HelpdeskDraftFormat = "detailed" | "checklist";

export function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

export function websiteLabel(url: string | null | undefined) {
  const t = norm(url);
  if (!t) return "—";
  try {
    const u = t.includes("://") ? new URL(t) : new URL(`https://${t}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.length > 32 ? `${t.slice(0, 29)}…` : t;
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString();
}

export function buildOccurrenceKeyFallback(
  auditId: string,
  occurrence: {
    occurrence_key?: string | null;
    selector?: string | null;
    snippet?: string | null;
    location?: string | null;
    offending_value?: string | null;
    explanation?: string | null;
  },
) {
  if (occurrence.occurrence_key) return occurrence.occurrence_key;
  return `${auditId}::${(occurrence.selector ?? "").trim()}::${(occurrence.snippet ?? "").trim()}::${(occurrence.location ?? "").trim()}::${(occurrence.offending_value ?? "").trim()}::${(occurrence.explanation ?? "").trim()}`;
}

export function buildTechnicalSummary(client: ClientRow): TechnicalSummary {
  const findings: TechnicalFinding[] = buildBaselineTechnicalFindings(client).map((finding) => ({
    ...finding,
    status: "open",
    confidence: finding.severity === "critical" ? "high" : "medium",
    impact: finding.severity === "critical" ? "high" : "medium",
    dueLabel: finding.severity === "critical" ? "Today" : "This week",
  }));

  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const openCount = findings.length;
  return {
    findings,
    hasCritical,
    openCount,
    health: hasCritical ? "Critical" : openCount > 0 ? "Watch" : "Good",
  };
}

export function channelLabel(channel: TechnicalChannel) {
  if (channel === "seo") return "SEO";
  if (channel === "ads") return "Ads";
  if (channel === "sitemaps") return "Sitemaps";
  return "Social";
}

export function buildSeoMetrics(client: ClientRow, findings: TechnicalFinding[]): ChannelMetric[] {
  const seoFindings = findings.filter((finding) => finding.channel === "seo");
  const criticalCount = seoFindings.filter(
    (finding) => finding.severity === "critical",
  ).length;
  return [
    {
      label: "Search Console",
      value: norm(client.sc_url) ? "Connected" : "Missing",
      source: "internal",
      definition: "Whether this client has a Search Console property URL saved in our database.",
    },
    {
      label: "Internal open issues",
      value: String(seoFindings.length),
      source: "internal",
      definition: "Count of SEO findings from internal app checks (not crawl/GSC/Lighthouse).",
    },
    {
      label: "Internal critical issues",
      value: String(criticalCount),
      source: "internal",
      definition: "Critical-only count from internal SEO checks.",
    },
  ];
}

export function buildSeoMetricsWithLighthouse(
  client: ClientRow,
  findings: TechnicalFinding[],
  lighthouse: LighthouseSnapshot | null,
): ChannelMetric[] {
  const base = buildSeoMetrics(client, findings);
  if (!lighthouse) return base;
  return [
    ...base,
    {
      label: "Lighthouse SEO",
      value:
        lighthouse.scores.seo == null ? "N/A" : `${lighthouse.scores.seo}/100`,
      source: "lighthouse",
      definition: "Latest Lighthouse SEO category score from PageSpeed API.",
      updatedAt: lighthouse.fetched_at,
    },
    {
      label: "Performance",
      value:
        lighthouse.scores.performance == null
          ? "N/A"
          : `${lighthouse.scores.performance}/100`,
      source: "lighthouse",
      definition: "Latest Lighthouse Performance category score from PageSpeed API.",
      updatedAt: lighthouse.fetched_at,
    },
    {
      label: "LCP",
      value: lighthouse.metrics.lcp ?? "N/A",
      source: "lighthouse",
      definition: "Largest Contentful Paint from latest Lighthouse run.",
      updatedAt: lighthouse.fetched_at,
    },
  ];
}

export function buildSitemapMetrics(
  client: ClientRow,
  findings: TechnicalFinding[],
  sitemapSnapshot: SitemapSnapshot | null,
): ChannelMetric[] {
  const sitemapFindings = findings.filter((finding) => finding.channel === "sitemaps");
  const hasWebsite = Boolean(norm(client.website));
  return [
    {
      label: "Sitemap URL",
      value: hasWebsite ? `${websiteLabel(client.website)}/sitemap.xml` : "Missing",
      source: "internal",
      definition: "Derived sitemap endpoint using the client website URL.",
    },
    {
      label: "Open issues",
      value: String(sitemapFindings.length),
      source: "internal",
      definition: "Count of internal sitemaps checks in this app.",
    },
    {
      label: "URLs in sitemap",
      value: sitemapSnapshot ? String(sitemapSnapshot.url_count) : hasWebsite ? "Not synced" : "Blocked",
      source: "crawl",
      definition: "How many URLs were found in sitemap sync.",
      updatedAt: sitemapSnapshot?.updated_at ?? null,
    },
  ];
}
