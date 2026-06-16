import { resolveSiteContext } from "@/lib/strategy-mapper/form-options";
import type {
  SiteContext,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperService,
  WebsiteSeoAuditResult,
  WebsiteSeoReportSection,
} from "@/types/strategy-mapper";

export function buildWebsiteAuditFramingNote(
  siteContext: SiteContext,
  auditMode: WebsiteSeoAuditResult["auditMode"],
): string {
  if (auditMode === "fix_now") {
    return "These findings reflect the live site today. Critical items should be remediated alongside Phase 1 SEO execution to protect rankings and conversion paths.";
  }
  if (siteContext === "brand_new_ground_up") {
    return "This baseline captures SEO readiness signals for planning. On-site remediation activates at launch when the new property goes live.";
  }
  return "This pre-launch baseline documents current-state gaps on the existing or staging property. Remediation is deferred to the launch window when Phase 1 on-site SEO tactics activate.";
}

export function buildWebsiteAuditSectionTitle(
  auditMode: WebsiteSeoAuditResult["auditMode"],
): string {
  return auditMode === "fix_now"
    ? "Current Website SEO Red Flags"
    : "Pre-Launch Baseline Audit";
}

export function assembleWebsiteSeoSection(
  audit: WebsiteSeoAuditResult,
  form: StrategyMapperFormData,
): WebsiteSeoReportSection {
  const siteContext = resolveSiteContext(form);
  return {
    sectionTitle: buildWebsiteAuditSectionTitle(audit.auditMode),
    framingNote: buildWebsiteAuditFramingNote(siteContext, audit.auditMode),
    redFlagSummary: audit.redFlagSummary,
    homepageTitle: audit.homepage.title,
    homepageMetaDescription: audit.homepage.metaDescription,
    homepageIssues: audit.homepage.issues,
    crawlIssueCount: audit.crawl.issueCount,
    topCrawlIssues: audit.crawl.topIssues,
    lighthouseSeoScore: audit.lighthouse?.scores.seo ?? null,
    keywordGaps: audit.keywordAlignment.gaps,
    keywordCoverage: audit.keywordAlignment.coverage,
  };
}

export function mergeWebsiteSeoAuditIntoReport(
  report: StrategyMapperReport,
  audit: WebsiteSeoAuditResult,
  form: StrategyMapperFormData,
  activeServices: StrategyMapperService[],
): StrategyMapperReport {
  if (audit.skipped) return report;

  const section = assembleWebsiteSeoSection(audit, form);
  const nextReport: StrategyMapperReport = {
    ...report,
    websiteSeoAudit: section,
  };

  if (
    audit.auditMode === "fix_now" &&
    activeServices.includes("seo") &&
    audit.redFlagSummary.length > 0
  ) {
    const redFlagFocus = audit.redFlagSummary.slice(0, 3).map((flag) => `Site audit: ${flag}`);
    nextReport.executiveSummary = {
      ...nextReport.executiveSummary,
      coreFocusAreas: [...redFlagFocus, ...nextReport.executiveSummary.coreFocusAreas],
    };
  }

  return nextReport;
}
