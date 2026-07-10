"use client";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import { METRIC_LABELS, type ReportConfig } from "@/lib/reporting/report-config-types";
import type { ReportPeriodMetric } from "@/lib/reporting/types";
import { buildSocialByPlatform, type PlatformSocial } from "@/lib/reporting/social-metrics";

const adsLabelToKey: Record<string, string> = Object.fromEntries(
  Object.entries(METRIC_LABELS.google_ads ?? {}).map(([k, v]) => [v, k]),
);

const ga4LabelToKey: Record<string, string> = Object.fromEntries(
  Object.entries(METRIC_LABELS.ga4 ?? {}).map(([k, v]) => [v, k]),
);

const BI_BLUE    = "#3D52C4";
const BI_PURPLE  = "#7B35B0";
const BI_MAGENTA = "#E4177F";
const C_SEARCH   = "#3D52C4";
const C_ADS      = "#059669";
const C_SOCIAL   = "#7B35B0";

// ── GA4 breakdown helpers (inline-styled for html2canvas/PDF safety) ──────────
function Ga4TableSection({
  title, subtitle, headers, rows,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;
  return (
    <section style={{ breakInside: "avoid" }} className="mb-7">
      <SectionLabel title={title} color={C_SEARCH} />
      {subtitle && <p className="text-xs text-gray-400 mb-2 -mt-1">{subtitle}</p>}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ borderTop: ri === 0 ? "none" : "1px solid #f3f4f6" }}>
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-2 text-gray-700 ${ci === 0 ? "" : "text-right"}`}
                    style={ci === 0 ? { maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Ga4TrendChart({ points }: { points: Array<{ date: string; sessions: number }> }) {
  if (points.length < 2) return null;
  const w = 680, h = 130, pad = 6;
  const max = Math.max(...points.map((p) => p.sessions), 1);
  const stepX = (w - pad * 2) / (points.length - 1);
  const xy = points.map((p, i) => [pad + i * stepX, h - pad - (p.sessions / max) * (h - pad * 2)] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${xy[xy.length - 1][0].toFixed(1)} ${h - pad} L ${xy[0][0].toFixed(1)} ${h - pad} Z`;
  return (
    <section style={{ breakInside: "avoid" }} className="mb-7">
      <SectionLabel title="Website Sessions — 30-day trend" color={C_SEARCH} />
      <div className="rounded-2xl p-4" style={{ border: "1px solid #e5e7eb" }}>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
          <path d={area} fill={`${C_SEARCH}14`} stroke="none" />
          <path d={line} fill="none" stroke={C_SEARCH} strokeWidth={2} />
        </svg>
      </div>
    </section>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const up = delta > 0;
  const neutral = delta === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        neutral ? "bg-gray-100 text-gray-500" : up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
    >
      {!neutral && (up ? "▲" : "▼")}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function MetricCard({ metric, accent }: { metric: ReportPeriodMetric; accent: string }) {
  const val =
    metric.current == null
      ? "—"
      : `${metric.valuePrefix ?? ""}${metric.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric.valueSuffix ?? ""}`;
  return (
    <div
      className="rounded-xl bg-white p-4 flex flex-col gap-2 shadow-sm"
      style={{
        border: "1px solid #e5e7eb",
        borderLeft: `4px solid ${accent}`,
        breakInside: "avoid",
      }}
    >
      <p className="text-xs text-gray-500">{metric.label}</p>
      <p className="text-3xl font-bold text-gray-900 leading-none">{val}</p>
      {metric.previous != null && (
        <div className="flex items-center gap-1.5">
          <DeltaBadge delta={metric.deltaPercent ?? null} />
          <span className="text-[10px] text-gray-400">vs prior period</span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3" style={{ breakAfter: "avoid" }}>
      <div className="w-1 h-3.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
        {title}
      </p>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const color =
    platform === "facebook" ? "#1877F2" :
    platform === "instagram" ? "#E1306C" : "#6b7280";
  return (
    <span className="inline-flex items-center gap-1.5 capitalize text-xs text-gray-700">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      {platform}
    </span>
  );
}

// Tiles shown for one platform's social block. Facebook reach is unavailable
// from Meta's API, so it's shown as a muted "Not available" rather than omitted.
function platformTiles(p: PlatformSocial): Array<{ label: string; display: string; muted?: boolean }> {
  const tiles: Array<{ label: string; display: string; muted?: boolean }> = [];
  if (p.reach != null) tiles.push({ label: "Reach", display: p.reach.toLocaleString() });
  else if (p.platform === "facebook") tiles.push({ label: "Reach", display: "Not available", muted: true });
  if (p.engagement > 0) tiles.push({ label: "Engagements", display: p.engagement.toLocaleString() });
  if (p.impressions != null && p.impressions > 0) tiles.push({ label: "Impressions", display: p.impressions.toLocaleString() });
  if (p.linkClicks > 0) tiles.push({ label: "Link clicks", display: p.linkClicks.toLocaleString() });
  tiles.push({ label: "New followers", display: p.newFollowers.toLocaleString() });
  return tiles;
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  report: ClientReportModel;
  config: ReportConfig;
  draft: ReportDraft | null;
  printMode?: boolean;
};

export default function ReportPreview({ report, config, draft, printMode = false }: Props) {
  function sectionVisible(key: string): boolean {
    const s = config.sections.find((sec) => sec.key === key);
    if (!s) return true; // new sections not yet in saved config default to visible
    return s.visible;
  }

  function SectionCallout({ sectionKey }: { sectionKey: string }) {
    const note = draft?.section_comments?.[sectionKey];
    if (!note?.trim()) return null;
    return (
      <div
        className="mt-4 rounded-lg px-4 py-3"
        style={{
          background: `${BI_PURPLE}0d`,
          borderLeft: `3px solid ${BI_PURPLE}`,
          breakInside: "avoid",
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: BI_PURPLE }}
        >
          Strategist note
        </p>
        <p className="text-xs text-gray-700 leading-5">{note}</p>
      </div>
    );
  }


  const { ads, searchConsole, ga4, keywords } = report.channels;

  const kpisSection = config.sections.find((s) => s.key === "kpis");
  const kpisVisible = kpisSection?.visible ?? false;

  const adsSubsection =
    kpisSection?.key === "kpis"
      ? kpisSection.subsections.find((s) => s.key === "google_ads")
      : undefined;
  const adsMetricVis = adsSubsection?.metrics ?? null;

  const adsMetrics = ads.metrics.filter((m) => {
    if (m.current == null || Number.isNaN(m.current)) return false;
    if (!adsMetricVis) return m.current !== 0;
    const configKey = adsLabelToKey[m.label];
    if (!configKey) return true;
    return adsMetricVis[configKey] !== false;
  });
  const gscMetrics = searchConsole.metrics.filter((m) => m.current != null && m.current !== 0);

  const ga4Subsection =
    kpisSection?.key === "kpis"
      ? kpisSection.subsections.find((s) => s.key === "ga4")
      : undefined;
  const ga4MetricVis = ga4Subsection?.metrics ?? null;
  const ga4Metrics = ga4.metrics.filter((m) => {
    if (m.current == null || Number.isNaN(m.current)) return false;
    if (!ga4MetricVis) return m.current !== 0;
    const configKey = ga4LabelToKey[m.label];
    if (!configKey) return m.current !== 0;
    return ga4MetricVis[configKey] !== false;
  });

  function subsectionVisible(subKey: string) {
    if (!kpisSection || kpisSection.key !== "kpis") return true;
    const sub = kpisSection.subsections.find((s) => s.key === subKey);
    return sub ? sub.visible : true;
  }

  const hasAds          = adsMetrics.length > 0;
  const hasGsc          = gscMetrics.length > 0;
  const hasGa4          = ga4Metrics.length > 0;
  const hasKeywords     = keywords.rows.length > 0;
  const hasGscTopPages  = report.gscTopPages.length > 0;
  const gscMaxClicks    = Math.max(...report.gscTopPages.map((p) => p.clicks), 1);

  const socialByPlatform = buildSocialByPlatform(report.socialDailyRows, report.socialPeriodReach);
  const hasSocialData = socialByPlatform.length > 0;

  const hasAnyData = hasAds || hasGsc || hasGa4 || hasGscTopPages || hasKeywords || hasSocialData;

  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <main
      className="report-print-target mx-auto max-w-4xl space-y-8 px-8 py-6 bg-white min-h-full"
      style={{ color: "#1f2937", fontFamily: "system-ui, sans-serif" }}
    >

      {/* ── Cover header ── */}
      <header
        className="rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${BI_BLUE} 0%, ${BI_PURPLE} 55%, ${BI_MAGENTA} 100%)`, breakInside: "avoid" }}
      >
        <div className="px-8 pt-7 pb-8">
          {/* Agency logo row */}
          <div className="flex items-center gap-2.5 mb-8">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
            >
              B
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
              Beyond Indigo Pets
            </span>
          </div>

          {/* Client name + meta */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                Client Performance Report
              </p>
              <h1 className="text-3xl font-bold leading-tight" style={{ color: "#fff" }}>
                {report.client.account_name}
              </h1>
            </div>
            <div className="text-right space-y-1" style={{ color: "rgba(255,255,255,0.75)" }}>
              <p className="text-sm font-semibold" style={{ color: "#fff" }}>
                {draft?.window_label ?? report.reportingWindowLabel}
              </p>
              <p className="text-xs">Generated {generatedDate}</p>
              <p className="text-xs">
                Strategist: {report.client.marketing_strategist || "Unassigned"}
              </p>
            </div>
          </div>

          {/* Download controls — hidden in the print/PDF output and on the print page */}
          {!printMode && (
            <div className="no-print mt-6 flex flex-col items-end gap-1.5">
              <a
                href={`/reports-print/${report.client.id}?range=${report.reportingWindowLabel.includes("7") ? "last7" : "last30"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-4 py-2 text-sm font-medium transition"
                style={{ border: "1px solid rgba(255,255,255,0.45)", color: "#fff", background: "rgba(255,255,255,0.12)" }}
              >
                Download report (PDF)
              </a>
              <a
                href={`/api/reports/${report.client.id}/word?range=${report.reportingWindowLabel.includes("7") ? "last7" : "last30"}`}
                className="text-xs underline"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Download as Word
              </a>
            </div>
          )}
        </div>
      </header>

      {/* ── From your strategist ── */}
      {draft?.narrative && (
        <section style={{ breakInside: "avoid" }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BI_BLUE}30` }}
          >
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(90deg, ${BI_BLUE}, ${BI_PURPLE}, ${BI_MAGENTA})` }}
            />
            <div className="px-7 py-6" style={{ background: `${BI_BLUE}07` }}>
              <h2
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: BI_BLUE }}
              >
                From your strategist
              </h2>
              <p className="text-sm leading-6 text-gray-700 whitespace-pre-line">{draft.narrative}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Performance Overview ── */}
      {kpisVisible && (hasGsc || hasAds || hasGa4) && (
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-1">Performance Overview</h2>
          <p className="text-xs text-gray-400 mb-6">
            Key metrics for {draft?.window_label ?? report.reportingWindowLabel} · changes vs prior period
          </p>

          {/* Organic Search */}
          {hasGsc && subsectionVisible("organic_search") && (
            <div className="mb-7" style={{ breakInside: "avoid" }}>
              <SectionLabel title="Organic Search" color={C_SEARCH} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {gscMetrics.map((m) => (
                  <MetricCard key={m.label} metric={m} accent={C_SEARCH} />
                ))}
              </div>
            </div>
          )}

          {/* Website Traffic */}
          {hasGa4 && subsectionVisible("ga4") && (
            <div className="mb-7" style={{ breakInside: "avoid" }}>
              <SectionLabel title="Website Traffic (GA4)" color={C_SEARCH} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ga4Metrics.map((m) => (
                  <MetricCard key={m.label} metric={m} accent={C_SEARCH} />
                ))}
              </div>

              {ga4.channelBreakdown && ga4.channelBreakdown.length > 0 && (
                <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Channel</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sessions</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Users</th>
                        <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Engagement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ga4.channelBreakdown.slice(0, 8).map((row, i) => (
                        <tr key={row.channel} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <td className="px-5 py-2.5 text-gray-700">{row.channel}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{row.sessions.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{row.users.toLocaleString()}</td>
                          <td className="px-5 py-2.5 text-right text-gray-700">{(row.engagementRate * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {ga4.topPages && ga4.topPages.length > 0 && (
                <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Top Page</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sessions</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Engagement</th>
                        <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Avg time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ga4.topPages.slice(0, 8).map((row, i) => (
                        <tr key={row.pagePath} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <td className="px-5 py-2.5 text-gray-700" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.pagePath}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{row.sessions.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{(row.engagementRate * 100).toFixed(1)}%</td>
                          <td className="px-5 py-2.5 text-right text-gray-700">{Math.floor(row.avgEngagementTimeSeconds / 60)}m {Math.round(row.avgEngagementTimeSeconds % 60)}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Google Ads */}
          {hasAds && subsectionVisible("google_ads") && (
            <div style={{ breakInside: "avoid" }}>
              <SectionLabel title="Google Ads" color={C_ADS} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {adsMetrics.map((m) => (
                  <MetricCard key={m.label} metric={m} accent={C_ADS} />
                ))}
              </div>
            </div>
          )}

          <SectionCallout sectionKey="kpis" />
        </section>
      )}

      {/* ── GA4 deep-dive breakdowns (each toggleable in Layout) ── */}
      {sectionVisible("ga4_conversions") && (ga4.conversionsByEvent?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="Conversions by Event (GA4)"
          subtitle="Which key events drove conversions this period"
          headers={["Event", "Conversions"]}
          rows={(ga4.conversionsByEvent ?? []).slice(0, 12).map((r) => [r.event_name, Math.round(r.conversions).toLocaleString()])}
        />
      )}
      {sectionVisible("ga4_geography") && (ga4.geoBreakdown?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="Geography (GA4)"
          subtitle="Where your website traffic comes from"
          headers={["Location", "Sessions", "Users"]}
          rows={(ga4.geoBreakdown ?? []).slice(0, 12).map((r) => [
            [r.city, r.region].filter(Boolean).join(", ") || "(not set)",
            r.sessions.toLocaleString(),
            r.users.toLocaleString(),
          ])}
        />
      )}
      {sectionVisible("ga4_device") && (ga4.deviceBreakdown?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="Device (GA4)"
          subtitle="Sessions by device category"
          headers={["Device", "Sessions", "Engagement"]}
          rows={(ga4.deviceBreakdown ?? []).map((r) => [r.device || "(unknown)", r.sessions.toLocaleString(), `${(r.engagement_rate * 100).toFixed(1)}%`])}
        />
      )}
      {sectionVisible("ga4_source_medium") && (ga4.sourceMediumBreakdown?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="Source / Medium (GA4)"
          subtitle="Detailed acquisition sources"
          headers={["Source / Medium", "Sessions", "Conversions"]}
          rows={(ga4.sourceMediumBreakdown ?? []).slice(0, 12).map((r) => [r.source_medium || "(not set)", r.sessions.toLocaleString(), Math.round(r.conversions).toLocaleString()])}
        />
      )}
      {sectionVisible("ga4_new_vs_returning") && (ga4.newVsReturning?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="New vs Returning (GA4)"
          subtitle="Visitor loyalty this period"
          headers={["Visitor Type", "Sessions", "Users"]}
          rows={(ga4.newVsReturning ?? []).map((r) => [r.cohort, r.sessions.toLocaleString(), r.users.toLocaleString()])}
        />
      )}
      {sectionVisible("ga4_trend") && (ga4.sessionsTrend?.length ?? 0) > 1 && (
        <Ga4TrendChart points={ga4.sessionsTrend ?? []} />
      )}
      {sectionVisible("ga4_landing") && (ga4.landingPages?.length ?? 0) > 0 && (
        <Ga4TableSection
          title="Landing Pages (GA4)"
          subtitle="Where visitors enter your site"
          headers={["Landing Page", "Sessions", "Engagement"]}
          rows={(ga4.landingPages ?? []).slice(0, 12).map((r) => [r.landing_page, r.sessions.toLocaleString(), `${(r.engagement_rate * 100).toFixed(1)}%`])}
        />
      )}

      {/* ── Search Traffic — Top Pages ── */}
      {sectionVisible("gsc_top_pages") && hasGscTopPages && (
        <section style={{ breakInside: "avoid" }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">Search Traffic</h2>
          <p className="text-xs text-gray-400 mb-4">
            Your top-performing pages in organic search this period
          </p>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            {/* Summary stats */}
            <div
              className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100"
              style={{ background: "#f9fafb" }}
            >
              {[
                { label: "Total clicks",       value: report.gscTopPages.reduce((s, p) => s + p.clicks, 0).toLocaleString() },
                { label: "Total impressions",  value: report.gscTopPages.reduce((s, p) => s + p.impressions, 0).toLocaleString() },
                { label: "Avg position",       value: (report.gscTopPages.reduce((s, p) => s + p.position, 0) / report.gscTopPages.length).toFixed(1) },
              ].map((stat) => (
                <div key={stat.label} className="px-5 py-4">
                  <p className="text-[10px] text-gray-400 mb-0.5">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Bar rows */}
            <div className="px-6 py-4 space-y-3">
              {report.gscTopPages.map((page, i) => {
                const pct = Math.round((page.clicks / gscMaxClicks) * 100);
                const label = page.page_url.replace(/^https?:\/\/[^/]+/, "") || "/";
                return (
                  <div
                    key={page.page_url}
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 52px" }}
                  >
                    <span
                      className="truncate text-xs text-gray-700"
                      title={page.page_url}
                      style={{ color: i === 0 ? BI_BLUE : undefined, fontWeight: i === 0 ? 600 : undefined }}
                    >
                      {label}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: i === 0 ? `linear-gradient(90deg, ${BI_BLUE}, ${BI_PURPLE})` : BI_BLUE, opacity: i === 0 ? 1 : 0.55 + i * 0.02 }}
                      />
                    </div>
                    <span className="text-right text-xs font-medium text-gray-600">
                      {page.clicks.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <SectionCallout sectionKey="gsc_top_pages" />
        </section>
      )}

      {/* ── Blog Performance ── */}
      {(() => {
        if (!sectionVisible("blog")) return null;
        const blogPages = report.gscTopBlogPages.slice(0, 10);
        if (blogPages.length === 0) return null;

        const totalClicks      = blogPages.reduce((s, p) => s + p.clicks, 0);
        const totalImpressions = blogPages.reduce((s, p) => s + p.impressions, 0);
        const page1Count       = blogPages.filter((p) => p.position <= 10).length;
        const blogMaxClicks    = Math.max(...blogPages.map((p) => p.clicks), 1);

        function postTitle(url: string) {
          const slug = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/blog\//, "").replace(/\/$/, "");
          return slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }

        const C_BLOG = "#0891b2"; // cyan-600 — distinct from search blue

        return (
          <section style={{ breakInside: "avoid" }}>
            <h2 className="text-base font-bold text-gray-900 mb-1">Blog Performance</h2>
            <p className="text-xs text-gray-400 mb-4">
              Organic search traffic driven by blog content
            </p>

            {/* Hero numbers */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Blog clicks",       value: totalClicks.toLocaleString() },
                { label: "Blog impressions",  value: totalImpressions.toLocaleString() },
                { label: "Posts on page 1",   value: page1Count.toString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white p-4 shadow-sm"
                  style={{ border: "1px solid #e5e7eb", borderLeft: `4px solid ${C_BLOG}` }}
                >
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 leading-none">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Top posts bar chart */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              <div className="border-b border-gray-100 px-6 py-3" style={{ background: "#f9fafb" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C_BLOG }}>
                  Top posts by clicks
                </p>
              </div>
              <div className="px-6 py-4 space-y-3.5">
                {blogPages.map((page, i) => {
                  const pct   = Math.round((page.clicks / blogMaxClicks) * 100);
                  const title = postTitle(page.page_url);
                  return (
                    <div key={page.page_url} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="text-xs text-gray-700 truncate"
                          style={{ fontWeight: i === 0 ? 600 : 400, color: i === 0 ? C_BLOG : undefined }}
                          title={title}
                        >
                          {title}
                        </span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[10px] text-gray-400">
                            pos {page.position.toFixed(1)}
                          </span>
                          <span className="text-xs font-medium text-gray-700 w-10 text-right">
                            {page.clicks.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: i === 0
                              ? `linear-gradient(90deg, ${C_BLOG}, #06b6d4)`
                              : C_BLOG,
                            opacity: i === 0 ? 1 : 0.5 + i * 0.02,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <SectionCallout sectionKey="blog" />
          </section>
        );
      })()}

      {/* ── Keyword Rankings ── */}
      {sectionVisible("keywords") && hasKeywords && (
        <section style={{ breakInside: "avoid" }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">Keyword Rankings</h2>
          <p className="text-xs text-gray-400 mb-4">{keywords.summary}</p>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr
                  className="text-left border-b border-gray-200"
                  style={{ background: "#f9fafb" }}
                >
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Keyword</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Position</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Change</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {keywords.rows.map((row, i) => {
                  const delta    = row.positionDelta;
                  const improved = delta != null && delta < 0;
                  const worsened = delta != null && delta > 0;
                  return (
                    <tr
                      key={row.keyword}
                      className="border-b border-gray-100 last:border-0"
                      style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-800">{row.keyword}</span>
                        {row.tag && (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-medium"
                            style={{ background: `${BI_BLUE}15`, color: BI_BLUE }}
                          >
                            {row.tag}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">
                        {row.currentPosition == null ? "—" : row.currentPosition.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {delta == null ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              improved ? "bg-emerald-50 text-emerald-700"
                              : worsened ? "bg-red-50 text-red-600"
                              : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {improved ? "▲" : worsened ? "▼" : "—"}
                            {Math.abs(delta).toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs">
                        <span className="font-semibold text-gray-800">
                          {row.currentClicks.toLocaleString()}
                        </span>
                        {row.previousClicks > 0 && (
                          <span className="ml-1 text-gray-400">
                            / {row.previousClicks.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SectionCallout sectionKey="keywords" />
        </section>
      )}

      {/* ── Organic Search Rankings (live SERP) ── */}
      {sectionVisible("keywords") && report.organicRanks.length > 0 && (
        <section style={{ breakInside: "avoid" }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">Organic Search Rankings</h2>
          <p className="text-xs text-gray-400 mb-4">Live Google organic (blue-link) position at the practice location</p>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200" style={{ background: "#f9fafb" }}>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Keyword</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Position</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Change</th>
                </tr>
              </thead>
              <tbody>
                {report.organicRanks.map((row, i) => {
                  const improved = row.delta != null && row.delta > 0;
                  const worsened = row.delta != null && row.delta < 0;
                  return (
                    <tr key={row.keyword} className="border-b border-gray-100 last:border-0" style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td className="px-5 py-3 font-medium text-gray-800">{row.keyword}</td>
                      <td className="px-3 py-3 text-right text-gray-700">
                        {row.position == null ? <span className="text-gray-400">Not in top 100</span> : `#${row.position}`}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.delta == null || row.delta === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              improved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {improved ? "▲" : "▼"}{Math.abs(row.delta)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Social Media ── */}
      {sectionVisible("social") && hasSocialData && (
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-1">Social Media</h2>
          <p className="text-xs text-gray-400 mb-4">Last 30 days, by platform</p>

          {/* Per-platform stat blocks */}
          {socialByPlatform.map((p) => (
            <div key={p.platform} className="mb-6" style={{ breakInside: "avoid" }}>
              <div className="mb-2 flex items-center gap-2">
                <PlatformBadge platform={p.platform} />
                <span className="text-sm font-semibold text-gray-700">
                  {p.platform === "facebook" ? "Facebook" : "Instagram"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {platformTiles(p).map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-xl bg-white p-4 shadow-sm"
                    style={{ border: "1px solid #e5e7eb", borderLeft: `4px solid ${C_SOCIAL}` }}
                  >
                    <p className="text-xs text-gray-500">{tile.label}</p>
                    <p className={`mt-1 font-bold text-gray-900 leading-none ${tile.muted ? "text-lg text-gray-400" : "text-3xl"}`}>
                      {tile.display}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Top posts table */}
          {report.topSocialPosts.length > 0 && (
            <div style={{ breakInside: "avoid" }}>
              <SectionLabel title="Recent top posts" color={C_SOCIAL} />
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left" style={{ background: "#f9fafb" }}>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Platform</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Caption</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Impressions</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topSocialPosts.map((post, i) => (
                      <tr
                        key={post.id}
                        className="border-b border-gray-100 last:border-0"
                        style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}
                      >
                        <td className="px-4 py-2.5">
                          <PlatformBadge platform={post.platform} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 text-xs max-w-xs">
                          {post.permalink ? (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline line-clamp-2"
                            >
                              {post.caption?.slice(0, 120) ?? "(no caption)"}
                            </a>
                          ) : (
                            <span className="line-clamp-2">
                              {post.caption?.slice(0, 120) ?? "(no caption)"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-700">
                          {post.impressions?.toLocaleString() ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-700">
                          {post.engagement?.toLocaleString() ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <SectionCallout sectionKey="social" />
        </section>
      )}

      {/* ── Google Business Profile ── */}
      {sectionVisible("gbp") && report.gbpSnapshot && (() => {
        const snap = report.gbpSnapshot!;
        const C_GBP = "#F59E0B"; // amber
        const nowUnix = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = nowUnix - 30 * 24 * 60 * 60;
        const recentReviews = report.gbpReviews.filter(
          (r) => r.review_time_unix != null && r.review_time_unix >= thirtyDaysAgo,
        );
        const recentAvg =
          recentReviews.length > 0
            ? recentReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / recentReviews.length
            : null;
        return (
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-1">Google Business Profile</h2>
            <p className="text-xs text-gray-400 mb-4">Reviews &amp; local listing metrics</p>

            <div className="grid gap-3 sm:grid-cols-3 mb-5" style={{ breakInside: "avoid" }}>
              {[
                {
                  label: "Overall rating",
                  value: snap.rating != null ? snap.rating.toFixed(1) : "—",
                  sub: snap.rating != null
                    ? "★".repeat(Math.round(snap.rating)) + "☆".repeat(5 - Math.round(snap.rating))
                    : null,
                },
                {
                  label: "Total reviews",
                  value: snap.user_ratings_total != null
                    ? snap.user_ratings_total.toLocaleString()
                    : "—",
                  sub: null,
                },
                {
                  label: "New reviews (30d)",
                  value: recentReviews.length.toString(),
                  sub: recentAvg != null ? `Avg ${recentAvg.toFixed(1)} ★` : null,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl bg-white p-4 shadow-sm"
                  style={{ border: "1px solid #e5e7eb", borderLeft: `4px solid ${C_GBP}` }}
                >
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900 leading-none">{card.value}</p>
                  {card.sub && <p className="mt-1 text-xs text-amber-500">{card.sub}</p>}
                </div>
              ))}
            </div>

            {report.gbpReviews.length > 0 && (
              <div style={{ breakInside: "avoid" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Recent reviews
                </p>
                <div className="space-y-3">
                  {report.gbpReviews.slice(0, 5).map((review, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white p-4"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">
                          {review.author_name ?? "Anonymous"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {review.review_time_unix
                            ? new Date(review.review_time_unix * 1000).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-amber-500 mb-1">
                        {"★".repeat(review.rating ?? 0)}{"☆".repeat(5 - (review.rating ?? 0))}
                      </p>
                      {review.text && (
                        <p className="text-xs text-gray-600 line-clamp-3">{review.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SectionCallout sectionKey="gbp" />
          </section>
        );
      })()}

      {/* ── Empty state ── */}
      {!hasAnyData && (
        <section className="rounded-2xl px-6 py-12 text-center" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-sm text-gray-500">No reporting data synced yet for this client.</p>
          <p className="mt-1 text-xs text-gray-400">
            Use the Sync tab on the left to pull fresh data from connected channels.
          </p>
        </section>
      )}

      {/* ── Footer ── */}
      <footer
        className="report-print-footer border-t border-gray-200 pt-5 pb-8"
        style={{ breakInside: "avoid" }}
      >
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-semibold" style={{ color: BI_BLUE }}>Beyond Indigo Pets</span>
          <span>
            Prepared for{" "}
            <span className="text-gray-600 font-medium">{report.client.account_name}</span>
            {report.client.marketing_strategist
              ? ` · ${report.client.marketing_strategist}`
              : ""}
          </span>
          <span>Confidential · {new Date().getFullYear()}</span>
        </div>
      </footer>

    </main>
  );
}
