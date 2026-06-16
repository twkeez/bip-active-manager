import { SERVICE_ICONS } from "@/lib/strategy-mapper/report-brand-tokens";
import {
  bodyShellStyle,
  bodyStyle,
  BRAND_COLORS,
  checklistItemStyle,
  bulletListStyle,
  containerStyle,
  h1Style,
  h2ServiceStyle,
  h2Style,
  highlightSpanStyle,
  labelStyle,
  observationBlockStyle,
  tableCellStyle,
  tableHeaderStyle,
  tableStyle,
} from "@/lib/strategy-mapper/report-brand-tokens";
import { stripMissionLabelPrefix, stripPainPointLabelPrefix } from "@/lib/strategy-mapper/report-sanitize";
import type {
  DualRadiusResult,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperService,
} from "@/types/strategy-mapper";

const COMMON_CLINICAL_TERMS = [
  "TPLO",
  "Tibial Plateau Leveling Osteotomy",
  "USDA Accredited",
  "USDA Accreditation",
  "USDA",
  "Fear Free Certified",
  "Fear Free",
  "llms.txt",
  "llms-full.txt",
  "Orthopedics",
  "ACL repair",
  "AEO",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSpecializations(form: StrategyMapperFormData): string {
  const items = [...form.specializations];
  if (form.customSpecialization.trim()) {
    items.push(form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "General practice";
}

export function collectHighlightTerms(form: StrategyMapperFormData): string[] {
  const terms = new Set<string>();

  for (const term of COMMON_CLINICAL_TERMS) {
    terms.add(term);
  }
  for (const spec of form.specializations) {
    if (spec.trim()) terms.add(spec.trim());
  }
  if (form.customSpecialization.trim()) {
    terms.add(form.customSpecialization.trim());
  }
  for (const procedure of form.salesPdfExtract?.primaryProcedures ?? []) {
    if (procedure.trim()) terms.add(procedure.trim());
  }
  if (form.salesPdfExtract?.clinicalDifferentiator.trim()) {
    const diff = form.salesPdfExtract.clinicalDifferentiator.trim();
    terms.add(diff);
    for (const part of diff.split(/[,;]/)) {
      const trimmed = part.trim();
      if (trimmed.length > 2) terms.add(trimmed);
    }
  }

  return [...terms].sort((a, b) => b.length - a.length);
}

export function highlightClinicalTerms(
  text: string,
  form: StrategyMapperFormData,
): string {
  const escaped = escapeHtml(text);
  const terms = collectHighlightTerms(form);
  let result = escaped;

  for (const term of terms) {
    if (term.length < 3) continue;
    const escapedTerm = escapeHtml(term);
    const pattern = new RegExp(
      `(?<![\\w-])(${escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\w-])`,
      "gi",
    );
    result = result.replace(pattern, (match, _group, offset) => {
      const before = result.slice(0, offset);
      const openSpans = (before.match(/<span\b/g) || []).length;
      const closeSpans = (before.match(/<\/span>/g) || []).length;
      if (openSpans > closeSpans) return match;
      return `<span style="${highlightSpanStyle()}">${match}</span>`;
    });
  }

  return result;
}

function brandedParagraph(
  html: string,
  extraStyle = "",
): string {
  return `<p style="${bodyStyle()}${extraStyle}">${html}</p>`;
}

function brandedLabel(label: string): string {
  return `<strong style="${labelStyle()}">${escapeHtml(label)}</strong>`;
}

function buildStyledTable(
  headers: string[],
  rows: string[][],
  form: StrategyMapperFormData,
): string {
  const headerCells = headers
    .map((h) => `<th style="${tableHeaderStyle()}">${escapeHtml(h)}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (cell) =>
              `<td style="${tableCellStyle()}">${highlightClinicalTerms(cell, form)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<table style="${tableStyle()}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function buildObservationBlock(
  title: string,
  marketObservation: string,
  whyItMatters: string,
  form: StrategyMapperFormData,
): string {
  return `<div style="${observationBlockStyle()}">
<h3 style="${h2ServiceStyle()} margin-top: 0;">${highlightClinicalTerms(title, form)}</h3>
<p style="${bodyStyle()} margin-bottom: 8px;">${brandedLabel("Market Observation:")} ${highlightClinicalTerms(marketObservation, form)}</p>
<p style="${bodyStyle()} margin-bottom: 0;">${brandedLabel("Why It Matters:")} ${highlightClinicalTerms(whyItMatters, form)}</p>
</div>`;
}

export function buildBrandedStrategyMapperHtml(
  form: StrategyMapperFormData,
  report: StrategyMapperReport,
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
): string {
  const logoHtml = form.logoDataUrl
    ? `<p style="${bodyStyle()}"><img src="${form.logoDataUrl}" alt="${escapeHtml(form.practiceName)} logo" style="max-height:80px;" /></p>`
    : "";

  const metaLines = [
    `${brandedLabel("Prepared for:")} ${escapeHtml(form.practiceName)}`,
    form.practiceOwnerName
      ? `${brandedLabel("Practice Owner/Lead:")} ${escapeHtml(form.practiceOwnerName)}`
      : "",
    `${brandedLabel("Geographic Focus:")} ${escapeHtml(form.streetAddress)} — ${escapeHtml(radius.geographicFocusLabel)}`,
    `${brandedLabel("Practice Type:")} ${escapeHtml(formatSpecializations(form))}`,
  ]
    .filter(Boolean)
    .join("<br/>");

  const focusAreas = report.executiveSummary.coreFocusAreas
    .map((item) => `<li>${highlightClinicalTerms(item, form)}</li>`)
    .join("");

  const auditTable = buildStyledTable(
    [
      "Veterinary Practice",
      "Distance",
      "Google Rating",
      "Total Reviews",
      "Active Google Ads?",
    ],
    report.competitiveAuditRows.map((row) => [
      row.practiceName,
      row.distance,
      row.googleRating,
      row.reviewCount,
      row.runsGoogleAds,
    ]),
    form,
  );

  const websiteAuditHtml = report.websiteSeoAudit
    ? (() => {
        const section = report.websiteSeoAudit;
        const redFlags = section.redFlagSummary
          .map((item) => `<li>${highlightClinicalTerms(item, form)}</li>`)
          .join("");
        const homepageIssues = section.homepageIssues
          .slice(0, 8)
          .map(
            (issue) =>
              `<li>${escapeHtml(issue.title)} — ${escapeHtml(issue.description)}</li>`,
          )
          .join("");
        const crawlIssues = section.topCrawlIssues
          .slice(0, 8)
          .map(
            (issue) =>
              `<li>${escapeHtml(issue.title)}${issue.url ? ` (${escapeHtml(issue.url)})` : ""}</li>`,
          )
          .join("");
        const keywordGapRows =
          section.keywordCoverage.length > 0
            ? buildStyledTable(
                ["Target keyword", "Found on site"],
                section.keywordCoverage.map((row) => [
                  row.keyword,
                  row.foundIn.length ? row.foundIn.join(", ") : "Not found",
                ]),
                form,
              )
            : "";
        const keywordGapList = section.keywordGaps
          .slice(0, 10)
          .map((gap) => `<li>${escapeHtml(gap)}</li>`)
          .join("");

        return `<h2 style="${h2Style()}">${escapeHtml(section.sectionTitle)}</h2>
${brandedParagraph(highlightClinicalTerms(section.framingNote, form))}
${redFlags ? `<ul style="${bulletListStyle()}">${redFlags}</ul>` : ""}
${brandedParagraph(`${brandedLabel("Homepage title:")} ${escapeHtml(section.homepageTitle ?? "Missing")}`)}
${brandedParagraph(`${brandedLabel("Meta description:")} ${escapeHtml(section.homepageMetaDescription ?? "Missing")}`)}
${homepageIssues ? `<h3 style="${h2ServiceStyle()}">Homepage issues</h3><ul style="${bulletListStyle()}">${homepageIssues}</ul>` : ""}
${crawlIssues ? `<h3 style="${h2ServiceStyle()}">Crawl findings (${section.crawlIssueCount} total)</h3><ul style="${bulletListStyle()}">${crawlIssues}</ul>` : ""}
${section.lighthouseSeoScore != null ? brandedParagraph(`${brandedLabel("Lighthouse SEO score:")} ${section.lighthouseSeoScore}`) : ""}
${keywordGapRows ? `<h3 style="${h2ServiceStyle()}">Keyword coverage</h3>${keywordGapRows}` : ""}
${keywordGapList ? `<h3 style="${h2ServiceStyle()}">Keyword gaps</h3><ul style="${bulletListStyle()}">${keywordGapList}</ul>` : ""}`;
      })()
    : "";

  const activeBlocks = activeServices
    .map((service) => {
      const block = report.activeStrategies[service];
      if (!block) return "";
      const icon = SERVICE_ICONS[service];
      const tactics = block.tactics
        .map(
          (tactic) =>
            `<li style="margin-bottom: 8px;">${highlightClinicalTerms(tactic, form)}</li>`,
        )
        .join("");

      let keywordSection = "";
      if (service === "seo" && report.seoKeywordMatrix.length > 0) {
        keywordSection = `<h3 style="${h2ServiceStyle()}">Targeted Keyword Matrix</h3>${buildStyledTable(
          [
            "Keyword Intent Category",
            "Target Geography",
            "Primary Target Keyword Variations",
          ],
          report.seoKeywordMatrix.map((row) => [
            row.intentCategory,
            row.targetGeography,
            row.keywordVariations.join(", "),
          ]),
          form,
        )}`;
      }

      return `<h2 style="${h2ServiceStyle()}">${icon} ${highlightClinicalTerms(block.title, form)}</h2>
${brandedParagraph(`${brandedLabel("Objective:")} ${highlightClinicalTerms(block.objective, form)}`)}
<ul style="${bulletListStyle()}">${tactics}</ul>
${keywordSection}`;
    })
    .join("");

  const growthBlocks = report.growthOpportunities
    .map((block) =>
      buildObservationBlock(
        block.title,
        block.marketObservation,
        block.whyItMatters,
        form,
      ),
    )
    .join("");

  const roadmapHtml = report.launchRoadmap
    .map(
      (step) =>
        brandedParagraph(
          `${brandedLabel(`${step.stepNumber}. ${step.title}:`)} ${highlightClinicalTerms(step.description, form)}`,
        ),
    )
    .join("");

  const checklistHtml =
    report.internalStrategistChecklist.length > 0
      ? `<ul style="${bulletListStyle()}">${report.internalStrategistChecklist
          .map(
            (item) =>
              `<li style="${checklistItemStyle()}">☐ ${highlightClinicalTerms(item, form)}</li>`,
          )
          .join("")}</ul>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="${bodyShellStyle()}">
<div style="${containerStyle()}">
<h1 style="${h1Style()}">BEYOND INDIGO PETS | CUSTOMIZED DIGITAL MARKETING PLAN</h1>
${logoHtml}
${brandedParagraph(metaLines)}
<h2 style="${h2Style()}">Executive Summary &amp; Targeted Growth Milestones</h2>
${brandedParagraph(`${brandedLabel("Our Shared Mission:")} ${highlightClinicalTerms(stripMissionLabelPrefix(report.executiveSummary.missionStatement), form)}`)}
${brandedParagraph(`${brandedLabel("Direct Pain-Point Resolution:")} ${highlightClinicalTerms(stripPainPointLabelPrefix(report.executiveSummary.painPointResolution), form)}`)}
${brandedParagraph(`${brandedLabel("Core Focus Areas:")}`)}
<ul style="${bulletListStyle()}">${focusAreas}</ul>
${brandedParagraph(highlightClinicalTerms(report.executiveSummary.narrative, form))}
<h2 style="${h2Style()}">Local Competitive Market Audit</h2>
${auditTable}
${websiteAuditHtml}
<h2 style="${h2Style()}">Phase 1 — Active Digital Marketing Strategy</h2>
${activeBlocks}
${growthBlocks ? `<h2 style="${h2Style()}">Phase 2 — Future Growth Opportunities &amp; Market Vulnerabilities</h2>${growthBlocks}` : ""}
${roadmapHtml ? `<h2 style="${h2Style()}">The Beyond Indigo Launch Roadmap</h2>${roadmapHtml}` : ""}
${checklistHtml ? `<h2 style="${h2Style()}">🛠️ INTERNAL STRATEGIST IMPLEMENTATION CHECKLIST</h2>${checklistHtml}` : ""}
</div>
</body>
</html>`;
}

export { BRAND_COLORS };
