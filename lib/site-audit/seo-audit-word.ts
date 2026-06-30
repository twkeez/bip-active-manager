import type {
  AuditRating,
  RatedSection,
  SeoAuditTemplateData,
} from "@/lib/site-audit/seo-audit-template";

// Renders the filled SEO audit template as an HTML document carrying the Office
// XML namespace, which Word opens natively as an editable .doc — no docx writer
// dependency needed. Brand palette mirrors components/reports/doc-to-pdf.tsx.

const INDIGO = "#3350a2";
const INDIGO_DEEP = "#23376e";
const PINK = "#ce2084";
const INK = "#374151";
const MUTED = "#6c7488";
const HAIRLINE = "#e0e3ec";

const RATING_LABELS: Array<{ value: AuditRating; label: string }> = [
  { value: "good", label: "Good" },
  { value: "needs_work", label: "Needs Work" },
  { value: "critical", label: "Critical" },
];

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function checkbox(checked: boolean, label: string): string {
  return `${checked ? "&#9745;" : "&#9744;"} ${esc(label)}`;
}

function ratingCell(rating: AuditRating | null): string {
  return RATING_LABELS.map((r) =>
    `<span style="margin-right:10px;white-space:nowrap;">${checkbox(rating === r.value, r.label)}</span>`,
  ).join("");
}

function ratedSectionHtml(section: RatedSection): string {
  const rows = section.items
    .map(
      (i) => `
      <tr>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;width:34%;">${esc(i.label)}</td>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;width:30%;font-size:11px;">${ratingCell(i.rating)}</td>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;width:36%;color:${INK};">${esc(i.notes)}</td>
      </tr>`,
    )
    .join("");
  return `
    <h2 style="color:${INDIGO_DEEP};font-size:15px;margin:22px 0 4px;">${esc(section.number)}&nbsp;&nbsp;${esc(section.title)}</h2>
    <p style="color:${MUTED};font-size:11px;margin:0 0 8px;">${esc(section.intro)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px;">
      <tr>
        <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Item</th>
        <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Rating</th>
        <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Notes</th>
      </tr>
      ${rows}
    </table>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:3px 10px 3px 0;color:${MUTED};font-size:12px;white-space:nowrap;">${esc(label)}</td>
    <td style="padding:3px 0;color:${INK};font-size:12px;font-weight:600;">${esc(value) || "&nbsp;"}</td>
  </tr>`;
}

function tierLine(selected: string | null): string {
  return (["Foundation", "Premium", "Premium Plus"] as const)
    .map((t) => `<span style="margin-right:14px;">${checkbox(selected === t, t)}</span>`)
    .join("");
}

function prioritiesHtml(priorities: string[]): string {
  const filled = priorities.filter((p) => p.trim());
  if (filled.length === 0) return "";
  return filled
    .map((p, idx) => `<p style="margin:2px 0;font-size:12px;color:${INK};"><strong>Priority ${idx + 1}:</strong> ${esc(p)}</p>`)
    .join("");
}

function recommendationsHtml(
  recommendations: SeoAuditTemplateData["recommendations"],
): string {
  if (recommendations.length === 0) return "";
  const rows = recommendations
    .map((r) => {
      const pr = r.priority ?? null;
      const priorityCell = (["high", "med", "low"] as const)
        .map((p) => `<span style="margin-right:8px;">${checkbox(pr === p, p === "med" ? "Med" : p === "high" ? "High" : "Low")}</span>`)
        .join("");
      return `<tr>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;">${esc(r.recommendation)}</td>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;font-size:11px;white-space:nowrap;">${priorityCell}</td>
        <td style="border:1px solid ${HAIRLINE};padding:6px 8px;">${esc(r.owner)}</td>
      </tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:12px;">
    <tr>
      <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Recommendation</th>
      <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Priority</th>
      <th style="border:1px solid ${HAIRLINE};background:#f3f5fa;padding:6px 8px;text-align:left;">Owner / Timeline</th>
    </tr>
    ${rows}
  </table>`;
}

function block(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<h2 style="color:${INDIGO_DEEP};font-size:15px;margin:22px 0 6px;">${esc(title)}</h2>${body}`;
}

function paragraph(text: string): string {
  if (!text.trim()) return "";
  return `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 8px;white-space:pre-wrap;">${esc(text)}</p>`;
}

export function renderSeoAuditWord(data: SeoAuditTemplateData): string {
  const m = data.meta;
  const swot = data.keywords.swot;
  const competitors = data.keywords.competitors.filter((c) => c.trim());

  const swotHtml = (Object.values(swot).some((v) => v.trim()))
    ? `<table style="border-collapse:collapse;width:100%;font-size:12px;">
        <tr>
          <td style="border:1px solid ${HAIRLINE};padding:8px;width:50%;"><strong>Strengths</strong><br>${esc(swot.strengths)}</td>
          <td style="border:1px solid ${HAIRLINE};padding:8px;width:50%;"><strong>Weaknesses</strong><br>${esc(swot.weaknesses)}</td>
        </tr>
        <tr>
          <td style="border:1px solid ${HAIRLINE};padding:8px;"><strong>Opportunities</strong><br>${esc(swot.opportunities)}</td>
          <td style="border:1px solid ${HAIRLINE};padding:8px;"><strong>Threats</strong><br>${esc(swot.threats)}</td>
        </tr>
      </table>`
    : "";

  const competitorsHtml = competitors.length
    ? competitors.map((c, i) => `<p style="margin:2px 0;font-size:12px;color:${INK};"><strong>Competitor ${i + 1}:</strong> ${esc(c)}</p>`).join("")
    : "";

  const body = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:${INK};max-width:760px;">
      <p style="color:${PINK};font-size:12px;font-weight:700;letter-spacing:1px;margin:0;text-transform:uppercase;">Beyond Indigo Pets</p>
      <h1 style="color:${INDIGO};font-size:24px;margin:2px 0 2px;">SEO Site Audit</h1>
      <p style="color:${MUTED};font-size:12px;margin:0 0 14px;">A guided walkthrough of technical, on-page, local, and content opportunities.</p>

      <table style="margin-bottom:8px;">
        ${metaRow("Client", m.client)}
        ${metaRow("Website", m.website)}
        ${metaRow("Audit Date", m.auditDate)}
        ${metaRow("Prepared By", m.preparedBy)}
      </table>
      <p style="font-size:12px;margin:0 0 8px;"><span style="color:${MUTED};">Package Tier:</span>&nbsp;&nbsp;${tierLine(m.packageTier)}</p>

      ${block("01&nbsp;&nbsp;Executive Summary", paragraph(data.executiveSummary) + prioritiesHtml(data.topPriorities))}

      ${data.ratedSections.map(ratedSectionHtml).join("")}

      ${block("07&nbsp;&nbsp;Structure & Content Opportunities", paragraph(data.contentOpportunities))}

      ${block("08&nbsp;&nbsp;Keywords & Competitors",
        paragraph(data.keywords.targetKeywords ? `Target Keywords: ${data.keywords.targetKeywords}` : "") +
        competitorsHtml + swotHtml)}

      ${block("09&nbsp;&nbsp;Recommendations & Next Steps", recommendationsHtml(data.recommendations))}
    </div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>SEO Site Audit - ${esc(m.client)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
</head>
<body>${body}</body>
</html>`;
}

/** Filename for the downloaded Word doc, e.g. "happy-paws-seo-audit-2026-06-30.doc". */
export function seoAuditWordFilename(data: SeoAuditTemplateData): string {
  const slug = (data.meta.client || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";
  return `${slug}-seo-audit-${data.meta.auditDate || "draft"}.doc`;
}
