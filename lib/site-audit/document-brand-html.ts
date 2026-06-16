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
import { includedBlocks, type SiteAuditDocumentDraft } from "@/lib/site-audit/document-draft";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priorityLabel(priority: string): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High Priority";
  return "Minor Adjust";
}

function headingStyle(level: 2 | 3): string {
  return level === 2 ? h2Style() : `color: #B31B6B; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: bold; margin: 16px 0 8px 0;`;
}

function blockToHtml(entry: SiteAuditDocumentDraft["blocks"][number]): string {
  const block = entry.block;
  switch (block.kind) {
    case "title":
      return `<h1 style="${h1Style()}">${escapeHtml(block.text)}</h1>`;
    case "heading":
      return `<h${block.level} style="${headingStyle(block.level)}">${escapeHtml(block.text)}</h${block.level}>`;
    case "meta":
      return `<p style="${bodyStyle()}"><strong style="${labelStyle()}">${escapeHtml(block.label)}:</strong> ${escapeHtml(block.value)}</p>`;
    case "paragraph":
      return block.text
        ? `<div style="${observationBlockStyle()}">${escapeHtml(block.text).replace(/\n/g, "<br/>")}</div>`
        : "";
    case "bullets":
      return block.items.filter(Boolean).length
        ? `<ul>${block.items.filter(Boolean).map((item) => `<li style="${bulletListStyle()}">${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";
    case "metric":
      return `<p style="${bodyStyle()}"><strong>${escapeHtml(block.label)}:</strong> ${escapeHtml(block.value)}</p>`;
    case "issue-group": {
      const issues = block.issues.filter((issue) => issue.included);
      if (!issues.length) return "";
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3><ul>${issues
        .map(
          (issue) =>
            `<li style="${bulletListStyle()}"><strong>${escapeHtml(issue.title)}</strong> — ${escapeHtml(priorityLabel(issue.priority))}<br/>${issue.description ? escapeHtml(issue.description) : ""}</li>`,
        )
        .join("")}</ul>`;
    }
    case "vitals":
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3>${block.items
        .map((item) => `<p style="${bodyStyle()}">${escapeHtml(item.label)}: ${escapeHtml(item.value)}</p>`)
        .join("")}`;
    case "sitemap":
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3><p style="${bodyStyle()}">URL: ${escapeHtml(block.url)} · Found: ${block.found ? "Yes" : "No"} · Count: ${block.urlCount}</p>`;
    case "schema":
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3><p style="${bodyStyle()}">${escapeHtml(block.summary)}</p>${block.recommendations.filter(Boolean).length ? `<ul>${block.recommendations.filter(Boolean).map((item) => `<li style="${bulletListStyle()}">${escapeHtml(item)}</li>`).join("")}</ul>` : ""}`;
    case "query-table":
      if (!block.rows.length) return "";
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3><table style="${tableStyle()}"><thead><tr><th style="${tableHeaderStyle()}">Query</th><th style="${tableHeaderStyle()}">Clicks</th><th style="${tableHeaderStyle()}">Impr.</th><th style="${tableHeaderStyle()}">Pos.</th></tr></thead><tbody>${block.rows
        .map(
          (row) =>
            `<tr><td style="${tableCellStyle()}">${escapeHtml(row.query)}</td><td style="${tableCellStyle()}">${row.clicks}</td><td style="${tableCellStyle()}">${row.impressions}</td><td style="${tableCellStyle()}">${row.position.toFixed(1)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    case "page-table":
      if (!block.rows.length) return "";
      return `<h3 style="${headingStyle(3)}">${escapeHtml(block.heading)}</h3><table style="${tableStyle()}"><thead><tr><th style="${tableHeaderStyle()}">URL</th><th style="${tableHeaderStyle()}">Status</th><th style="${tableHeaderStyle()}">Words</th></tr></thead><tbody>${block.rows
        .map(
          (row) =>
            `<tr><td style="${tableCellStyle()}">${escapeHtml(row.url)}</td><td style="${tableCellStyle()}">${row.status || "—"}</td><td style="${tableCellStyle()}">${row.wordCount}</td></tr>`,
        )
        .join("")}</tbody></table>`;
  }
}

export function buildDocumentBrandedHtml(draft: SiteAuditDocumentDraft): string {
  const body = includedBlocks(draft)
    .map((entry) => blockToHtml(entry))
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Beyond Indigo Site Audit</title></head>
<body style="${bodyShellStyle()}">
  <div style="${containerStyle()}">
    <p style="${bodyStyle()}"><strong style="${labelStyle()}">BEYOND INDIGO PETS</strong> · beyondindigopets.com</p>
    ${body}
    <p style="${bodyStyle()}; margin-top: 32px; font-size: 12px; text-align: center; color: ${BRAND_COLORS.brandText};">
      Prepared by Beyond Indigo Pets | beyondindigopets.com | (877) 244-9322
    </p>
  </div>
</body>
</html>`;
}

export function buildDocumentPlainText(draft: SiteAuditDocumentDraft): string {
  const lines = ["BEYOND INDIGO PETS | WEBSITE SEO AUDIT", ""];

  for (const entry of includedBlocks(draft)) {
    const block = entry.block;
    switch (block.kind) {
      case "title":
        lines.push(block.text, "");
        break;
      case "heading":
        lines.push(block.text, "");
        break;
      case "meta":
        lines.push(`${block.label}: ${block.value}`);
        break;
      case "paragraph":
        if (block.text) lines.push(block.text, "");
        break;
      case "bullets":
        lines.push(...block.items.filter(Boolean).map((item) => `• ${item}`), "");
        break;
      case "metric":
        lines.push(`${block.label}: ${block.value}`);
        break;
      case "issue-group":
        lines.push(block.heading);
        for (const issue of block.issues.filter((item) => item.included)) {
          lines.push(`• [${issue.priority}] ${issue.title}`);
          if (issue.description) lines.push(`  ${issue.description}`);
        }
        lines.push("");
        break;
      default:
        lines.push("");
    }
  }

  lines.push("Prepared by Beyond Indigo Pets | beyondindigopets.com | (877) 244-9322");
  return lines.join("\n");
}
