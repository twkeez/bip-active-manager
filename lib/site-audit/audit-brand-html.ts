import {
  bodyShellStyle,
  bodyStyle,
  BRAND_COLORS,
  bulletListStyle,
  containerStyle,
  h1Style,
  h2Style,
  labelStyle,
  observationBlockStyle,
  tableCellStyle,
  tableHeaderStyle,
  tableStyle,
} from "@/lib/strategy-mapper/report-brand-tokens";
import {
  INSPECTOR_TAB_LABELS,
  type SiteAuditExportModel,
} from "@/lib/site-audit/export-model";
import type { InspectorPriority, InspectorTab } from "@/lib/site-audit/inspector-issues";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priorityLabel(priority: InspectorPriority): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High Priority";
  return "Minor Adjust";
}

function issueSectionHtml(model: SiteAuditExportModel, tab: InspectorTab): string {
  const section = model.issuesByTab[tab];
  if (section.items.length === 0) return "";

  const rows = section.items
    .map(
      (issue) =>
        `<li style="${bulletListStyle()}"><strong>${escapeHtml(issue.title)}</strong> — ${escapeHtml(priorityLabel(issue.priority))}<br/>${issue.description ? escapeHtml(issue.description) : ""}<br/><span style="font-size:12px;color:#718096;">${escapeHtml(issue.source)}</span></li>`,
    )
    .join("");

  const truncated =
    section.truncatedCount > 0
      ? `<p style="${bodyStyle()}"><em>+ ${section.truncatedCount} additional issues available in the app.</em></p>`
      : "";

  return `<h2 style="${h2Style()}">${escapeHtml(INSPECTOR_TAB_LABELS[tab])}</h2><ul>${rows}</ul>${truncated}`;
}

export function buildSiteAuditBrandedHtml(model: SiteAuditExportModel): string {
  const scoreRows = model.scoreCards
    .map(
      (card) =>
        `<tr><td style="${tableCellStyle()}">${escapeHtml(card.label)}</td><td style="${tableCellStyle()}"><strong>${escapeHtml(card.value)}</strong></td></tr>`,
    )
    .join("");

  const summaryBlock = model.summary?.markdown
    ? `<h2 style="${h2Style()}">Executive Summary</h2><div style="${observationBlockStyle()}">${escapeHtml(model.summary.markdown).replace(/\n/g, "<br/>")}</div>`
    : "";

  const prioritizedFixes =
    model.summary?.prioritizedFixes?.length
      ? `<h2 style="${h2Style()}">Prioritized Fixes</h2><ul>${model.summary.prioritizedFixes
          .map(
            (fix) =>
              `<li style="${bulletListStyle()}">${escapeHtml(fix)}</li>`,
          )
          .join("")}</ul>`
      : "";

  const issueSections = (["seo", "performance", "code"] as InspectorTab[])
    .map((tab) => issueSectionHtml(model, tab))
    .filter(Boolean)
    .join("");

  const appendixPages =
    model.topPages.length > 0
      ? `<h2 style="${h2Style()}">Page Inventory (sample)</h2><table style="${tableStyle()}"><thead><tr><th style="${tableHeaderStyle()}">URL</th><th style="${tableHeaderStyle()}">Status</th><th style="${tableHeaderStyle()}">Words</th></tr></thead><tbody>${model.topPages
          .map(
            (page) =>
              `<tr><td style="${tableCellStyle()}">${escapeHtml(page.url)}</td><td style="${tableCellStyle()}">${page.status || "—"}</td><td style="${tableCellStyle()}">${page.wordCount}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Website SEO Audit — ${escapeHtml(model.siteUrl)}</title>
</head>
<body style="${bodyShellStyle()}">
  <div style="${containerStyle()}">
    <p style="${bodyStyle()}"><strong style="${labelStyle()}">BEYOND INDIGO PETS</strong> · beyondindigopets.com</p>
    <h1 style="${h1Style()}">Website SEO Audit</h1>
    <p style="${bodyStyle()}"><strong style="${labelStyle()}">Site:</strong> ${escapeHtml(model.siteUrl)}</p>
    <p style="${bodyStyle()}"><strong style="${labelStyle()}">Audit date:</strong> ${escapeHtml(model.formattedDate)}</p>
    <p style="${bodyStyle()}"><strong style="${labelStyle()}">Status:</strong> ${escapeHtml(model.status)}</p>

    <h2 style="${h2Style()}">Audit Snapshot</h2>
    <table style="${tableStyle()}">
      <thead><tr><th style="${tableHeaderStyle()}">Metric</th><th style="${tableHeaderStyle()}">Value</th></tr></thead>
      <tbody>${scoreRows}</tbody>
    </table>

    ${summaryBlock}
    ${prioritizedFixes}

    <h2 style="${h2Style()}">Issue Checklist</h2>
    <p style="${bodyStyle()}">Critical: ${model.issueSummary.critical} · High priority: ${model.issueSummary.high} · Minor: ${model.issueSummary.mediumLow} · Passed checks: ${model.issueSummary.passed}</p>
    ${issueSections}
    ${appendixPages}

    <p style="${bodyStyle()}; margin-top: 32px; color: ${BRAND_COLORS.brandText}; font-size: 12px; text-align: center;">
      Prepared by Beyond Indigo Pets | beyondindigopets.com | (877) 244-9322
    </p>
  </div>
</body>
</html>`;
}
