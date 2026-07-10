import type { ClientReportModel, ReportChannelBlock, ReportPeriodMetric } from "@/lib/reporting/types";
import type { ReportConfig } from "@/lib/reporting/report-config-types";
import { buildSocialByPlatform } from "@/lib/reporting/social-metrics";

// Brand palette mirrors lib/site-audit/seo-audit-word.ts so report and audit
// deliverables look consistent. All colors inline-hex (Word can't read CSS vars).
const INDIGO = "#3350a2";
const INDIGO_DEEP = "#23376e";
const PINK = "#ce2084";
const INK = "#374151";
const MUTED = "#6c7488";
const HAIRLINE = "#e0e3ec";
const HEAD_BG = "#f3f5fa";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function block(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<h2 style="color:${INDIGO_DEEP};font-size:15px;margin:22px 0 6px;">${esc(title)}</h2>${body}`;
}

function paragraph(text: string): string {
  if (!text.trim()) return "";
  return `<p style="font-size:12px;color:${INK};line-height:1.5;margin:0 0 8px;white-space:pre-wrap;">${esc(text)}</p>`;
}

// Renders a data table; returns "" when there are no rows so empty sections drop out.
function table(headers: string[], rows: Array<Array<string | number>>): string {
  if (rows.length === 0) return "";
  const th = headers
    .map((h, i) => `<th style="border:1px solid ${HAIRLINE};background:${HEAD_BG};padding:6px 8px;text-align:${i === 0 ? "left" : "right"};font-size:11px;color:${INDIGO_DEEP};">${esc(h)}</th>`)
    .join("");
  const trs = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td style="border:1px solid ${HAIRLINE};padding:6px 8px;text-align:${i === 0 ? "left" : "right"};font-size:12px;color:${INK};">${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;margin:0 0 8px;"><tr>${th}</tr>${trs}</table>`;
}

function sectionOn(config: ReportConfig, key: string): boolean {
  const s = config.sections.find((x) => x.key === key);
  return s ? s.visible : true;
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtMetricValue(m: ReportPeriodMetric): string {
  if (m.current == null) return "—";
  return `${m.valuePrefix ?? ""}${fmtNum(m.current)}${m.valueSuffix ?? ""}`;
}

function fmtDelta(deltaPercent: number | null): string {
  if (deltaPercent == null) return "—";
  return `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function pagePath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "") || "/";
}

// GA4 (Website Traffic) — metrics plus the enabled breakdown sub-sections.
function ga4Html(ga4: ReportChannelBlock, config: ReportConfig): string {
  const metrics = ga4.metrics.filter((m) => m.current != null && m.current !== 0);
  let html = table(
    ["Metric", "This period", "Change"],
    metrics.map((m) => [m.label, fmtMetricValue(m), fmtDelta(m.deltaPercent)]),
  );
  if (ga4.channelBreakdown?.length) {
    html += block(
      "Traffic by channel",
      table(["Channel", "Sessions", "Engagement"], ga4.channelBreakdown.map((r) => [r.channel, r.sessions.toLocaleString(), pct(r.engagementRate)])),
    );
  }
  if (ga4.topPages?.length) {
    html += block(
      "Top pages",
      table(["Page", "Sessions", "Engagement"], ga4.topPages.slice(0, 10).map((r) => [pagePath(r.pagePath), r.sessions.toLocaleString(), pct(r.engagementRate)])),
    );
  }
  if (sectionOn(config, "ga4_source_medium") && ga4.sourceMediumBreakdown?.length) {
    html += block(
      "Source / medium",
      table(["Source / medium", "Sessions", "Conversions"], ga4.sourceMediumBreakdown.slice(0, 12).map((r) => [r.source_medium || "(not set)", r.sessions.toLocaleString(), Math.round(r.conversions).toLocaleString()])),
    );
  }
  if (sectionOn(config, "ga4_landing") && ga4.landingPages?.length) {
    html += block(
      "Landing pages",
      table(["Landing page", "Sessions", "Engagement"], ga4.landingPages.slice(0, 12).map((r) => [pagePath(r.landing_page), r.sessions.toLocaleString(), pct(r.engagement_rate)])),
    );
  }
  if (sectionOn(config, "ga4_conversions") && ga4.conversionsByEvent?.length) {
    html += block(
      "Conversions by event",
      table(["Event", "Conversions"], ga4.conversionsByEvent.slice(0, 12).map((r) => [r.event_name, Math.round(r.conversions).toLocaleString()])),
    );
  }
  if (sectionOn(config, "ga4_geography") && ga4.geoBreakdown?.length) {
    html += block(
      "Geography",
      table(["Location", "Sessions", "Users"], ga4.geoBreakdown.slice(0, 12).map((r) => [[r.city, r.region].filter(Boolean).join(", ") || "(unknown)", r.sessions.toLocaleString(), r.users.toLocaleString()])),
    );
  }
  if (sectionOn(config, "ga4_device") && ga4.deviceBreakdown?.length) {
    html += block(
      "Device",
      table(["Device", "Sessions", "Engagement"], ga4.deviceBreakdown.map((r) => [r.device || "(unknown)", r.sessions.toLocaleString(), pct(r.engagement_rate)])),
    );
  }
  if (sectionOn(config, "ga4_new_vs_returning") && ga4.newVsReturning?.length) {
    html += block(
      "New vs returning",
      table(["Cohort", "Sessions", "Users"], ga4.newVsReturning.map((r) => [r.cohort, r.sessions.toLocaleString(), r.users.toLocaleString()])),
    );
  }
  return html;
}

function topPagesTable(pages: ClientReportModel["gscTopPages"]): string {
  if (pages.length === 0) return "";
  const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
  const totalImpr = pages.reduce((s, p) => s + p.impressions, 0);
  const avgPos = pages.reduce((s, p) => s + p.position, 0) / pages.length;
  const summary = `<p style="font-size:12px;color:${MUTED};margin:0 0 6px;">${totalClicks.toLocaleString()} clicks · ${totalImpr.toLocaleString()} impressions · avg position ${avgPos.toFixed(1)}</p>`;
  return summary + table(
    ["Page", "Clicks", "Impressions", "Position"],
    pages.map((p) => [pagePath(p.page_url), p.clicks.toLocaleString(), p.impressions.toLocaleString(), p.position.toFixed(1)]),
  );
}

function socialHtml(report: ClientReportModel): string {
  const platforms = buildSocialByPlatform(report.socialDailyRows, report.socialPeriodReach);
  if (platforms.length === 0) return "";
  return platforms
    .map((p) => {
      const rows: Array<[string, string]> = [];
      rows.push(["Reach", p.reach != null ? p.reach.toLocaleString() : p.platform === "facebook" ? "Not available" : "—"]);
      if (p.engagement > 0) rows.push(["Engagements", p.engagement.toLocaleString()]);
      if (p.impressions != null && p.impressions > 0) rows.push(["Impressions", p.impressions.toLocaleString()]);
      if (p.linkClicks > 0) rows.push(["Link clicks", p.linkClicks.toLocaleString()]);
      rows.push(["New followers", p.newFollowers.toLocaleString()]);
      const title = p.platform === "facebook" ? "Facebook" : "Instagram";
      return `<h3 style="color:${INDIGO_DEEP};font-size:13px;margin:12px 0 4px;">${title}</h3>` + table(["Metric", "Value"], rows);
    })
    .join("");
}

export function renderReportWord(report: ClientReportModel, config: ReportConfig): string {
  const client = report.client;
  const generated = new Date(report.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const exec = report.executiveSummary;
  const execBody =
    (exec.overallDeltaPercent != null
      ? paragraph(`Overall performance ${exec.overallDeltaPercent >= 0 ? "up" : "down"} ${Math.abs(exec.overallDeltaPercent).toFixed(1)}% vs. the prior period.`)
      : "") + paragraph(report.summaryText);

  const kpiBody = table(
    ["Metric", "Value"],
    report.kpis.map((k) => [k.label, k.value]),
  );

  const ga4 = report.channels.ga4;
  const ads = report.channels.ads;
  const keywords = report.channels.keywords;

  const adsMetrics = ads.metrics.filter((m) => m.current != null && m.current !== 0);
  const adsBody = table(["Metric", "This period", "Change"], adsMetrics.map((m) => [m.label, fmtMetricValue(m), fmtDelta(m.deltaPercent)]));

  const keywordBody = table(
    ["Keyword", "Position", "Change", "Clicks"],
    keywords.rows.map((r) => [
      r.keyword,
      r.currentPosition != null ? r.currentPosition.toFixed(1) : "—",
      r.positionDelta != null ? `${r.positionDelta <= 0 ? "" : "+"}${r.positionDelta.toFixed(1)}` : "—",
      r.currentClicks.toLocaleString(),
    ]),
  );

  const organicBody = report.organicRanks.length
    ? table(
        ["Keyword", "Organic position", "Change"],
        report.organicRanks.map((r) => [
          r.keyword,
          r.position == null ? "Not in top 100" : `#${r.position}`,
          r.delta == null || r.delta === 0 ? "—" : `${r.delta > 0 ? "▲" : "▼"}${Math.abs(r.delta)}`,
        ]),
      )
    : "";

  const gbp = report.gbpSnapshot;
  const gbpBody = gbp
    ? table(
        ["Metric", "Value"],
        [
          ["Rating", gbp.rating != null ? `${gbp.rating.toFixed(1)} ★` : "—"],
          ["Reviews", (gbp.user_ratings_total ?? 0).toLocaleString()],
        ],
      )
    : "";

  const recBody = report.recommendations.length
    ? table(["Priority", "Recommendation"], report.recommendations.map((r) => [r.priority.toUpperCase(), r.text]))
    : "";

  const body = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:${INK};max-width:760px;">
      <p style="color:${PINK};font-size:12px;font-weight:700;letter-spacing:1px;margin:0;text-transform:uppercase;">Beyond Indigo Pets</p>
      <h1 style="color:${INDIGO};font-size:24px;margin:2px 0 2px;">Marketing Report</h1>
      <p style="color:${MUTED};font-size:12px;margin:0 0 14px;">${esc(report.reportingWindowLabel)} · generated ${esc(generated)}</p>
      <table style="margin-bottom:10px;">
        <tr><td style="font-size:12px;color:${MUTED};padding:2px 12px 2px 0;">Client</td><td style="font-size:12px;color:${INK};font-weight:600;">${esc(client.account_name)}</td></tr>
        ${client.contact_name ? `<tr><td style="font-size:12px;color:${MUTED};padding:2px 12px 2px 0;">Prepared for</td><td style="font-size:12px;color:${INK};">${esc(client.contact_name)}</td></tr>` : ""}
        ${client.website ? `<tr><td style="font-size:12px;color:${MUTED};padding:2px 12px 2px 0;">Website</td><td style="font-size:12px;color:${INK};">${esc(client.website)}</td></tr>` : ""}
      </table>

      ${block("Executive summary", execBody)}
      ${sectionOn(config, "kpis") ? block("Performance overview", kpiBody) : ""}
      ${block("Website traffic (GA4)", ga4Html(ga4, config))}
      ${sectionOn(config, "gsc_top_pages") ? block("Search traffic", topPagesTable(report.gscTopPages)) : ""}
      ${sectionOn(config, "blog") ? block("Blog performance", topPagesTable(report.gscTopBlogPages)) : ""}
      ${sectionOn(config, "keywords") ? block("Keyword rankings", keywordBody) : ""}
      ${sectionOn(config, "keywords") ? block("Organic search rankings", organicBody) : ""}
      ${block("Google Ads", adsBody)}
      ${sectionOn(config, "gbp") ? block("Google Business Profile", gbpBody) : ""}
      ${sectionOn(config, "social") ? block("Social media", socialHtml(report)) : ""}
      ${block("Recommendations", recBody)}
    </div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Marketing Report - ${esc(client.account_name)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
</head>
<body>${body}</body>
</html>`;
}

export function reportWordFilename(report: ClientReportModel): string {
  const slug = (report.client.account_name || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  const date = new Date(report.generatedAt).toISOString().slice(0, 10);
  return `${slug}-marketing-report-${date}.doc`;
}
