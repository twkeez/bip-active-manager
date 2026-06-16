import { SERVICE_LABELS } from "@/lib/strategy-mapper/form-options";
import { buildBrandedStrategyMapperHtml } from "@/lib/strategy-mapper/report-brand-html";
import { stripMissionLabelPrefix, stripPainPointLabelPrefix } from "@/lib/strategy-mapper/report-sanitize";
import type {
  DualRadiusResult,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperService,
} from "@/types/strategy-mapper";

function formatSpecializations(form: StrategyMapperFormData): string {
  const items = [...form.specializations];
  if (form.customSpecialization.trim()) {
    items.push(form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "General practice";
}

export function buildStrategyMapperPlainText(
  form: StrategyMapperFormData,
  report: StrategyMapperReport,
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
): string {
  const lines: string[] = [
    "BEYOND INDIGO PETS | CUSTOMIZED DIGITAL MARKETING PLAN",
    `Prepared for: ${form.practiceName}`,
    form.practiceOwnerName
      ? `Practice Owner/Lead: ${form.practiceOwnerName}`
      : "",
    `Geographic Focus: ${form.streetAddress} — ${radius.geographicFocusLabel}`,
    `Practice Type: ${formatSpecializations(form)}`,
    "",
    "Executive Summary & Targeted Growth Milestones",
    `Our Shared Mission: ${stripMissionLabelPrefix(report.executiveSummary.missionStatement)}`,
    `Direct Pain-Point Resolution: ${stripPainPointLabelPrefix(report.executiveSummary.painPointResolution)}`,
    "Core Focus Areas:",
    ...report.executiveSummary.coreFocusAreas.map((item) => `• ${item}`),
    report.executiveSummary.narrative,
    "",
    "Local Competitive Market Audit",
    "Practice | Distance | Google Rating | Total Reviews | Active Google Ads?",
  ];

  for (const row of report.competitiveAuditRows) {
    lines.push(
      `${row.practiceName} | ${row.distance} | ${row.googleRating} | ${row.reviewCount} | ${row.runsGoogleAds}`,
    );
  }

  if (report.websiteSeoAudit) {
    const section = report.websiteSeoAudit;
    lines.push("", section.sectionTitle);
    lines.push(section.framingNote);
    if (section.redFlagSummary.length) {
      lines.push("Red flags:");
      for (const item of section.redFlagSummary) {
        lines.push(`• ${item}`);
      }
    }
    lines.push(`Homepage title: ${section.homepageTitle ?? "Missing"}`);
    lines.push(`Meta description: ${section.homepageMetaDescription ?? "Missing"}`);
    if (section.keywordGaps.length) {
      lines.push("Keyword gaps:");
      for (const gap of section.keywordGaps) {
        lines.push(`• ${gap}`);
      }
    }
  }

  lines.push("", "Phase 1 — Active Digital Marketing Strategy");
  for (const service of activeServices) {
    const block = report.activeStrategies[service];
    if (!block) continue;
    lines.push("", block.title);
    lines.push(`Objective: ${block.objective}`);
    for (const tactic of block.tactics) {
      lines.push(`• ${tactic}`);
    }
    if (service === "seo" && report.seoKeywordMatrix.length > 0) {
      lines.push("", "Targeted Keyword Matrix");
      lines.push("Intent Category | Target Geography | Keyword Variations");
      for (const row of report.seoKeywordMatrix) {
        lines.push(
          `${row.intentCategory} | ${row.targetGeography} | ${row.keywordVariations.join(", ")}`,
        );
      }
    }
  }

  if (report.growthOpportunities.length > 0) {
    lines.push("", "Phase 2 — Future Growth Opportunities & Market Vulnerabilities");
    for (const block of report.growthOpportunities) {
      lines.push("", block.title);
      lines.push(`Market Observation: ${block.marketObservation}`);
      lines.push(`Why It Matters: ${block.whyItMatters}`);
    }
  }

  if (report.launchRoadmap.length > 0) {
    lines.push("", "The Beyond Indigo Launch Roadmap");
    for (const step of report.launchRoadmap) {
      lines.push(`${step.stepNumber}. ${step.title}: ${step.description}`);
    }
  }

  if (report.internalStrategistChecklist.length > 0) {
    lines.push("", "🛠️ INTERNAL STRATEGIST IMPLEMENTATION CHECKLIST");
    for (const item of report.internalStrategistChecklist) {
      lines.push(`• ${item}`);
    }
  }

  return lines.filter(Boolean).join("\n");
}

export function buildStrategyMapperHtml(
  form: StrategyMapperFormData,
  report: StrategyMapperReport,
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
): string {
  return buildBrandedStrategyMapperHtml(form, report, radius, activeServices);
}

export async function copyStrategyMapperToClipboard(
  form: StrategyMapperFormData,
  report: StrategyMapperReport,
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
): Promise<void> {
  const html = buildStrategyMapperHtml(form, report, radius, activeServices);
  const plain = buildStrategyMapperPlainText(form, report, radius, activeServices);

  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard.write === "function"
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(plain);
}

export { SERVICE_LABELS };
