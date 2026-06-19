"use client";
import { useRef, useState } from "react";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import { METRIC_LABELS, type ReportConfig } from "@/lib/reporting/report-config-types";
import type { ReportPeriodMetric } from "@/lib/reporting/types";

const adsLabelToKey: Record<string, string> = Object.fromEntries(
  Object.entries(METRIC_LABELS.google_ads ?? {}).map(([k, v]) => [v, k]),
);

const BI_BLUE = "#3D52C4";
const BI_PURPLE = "#7B35B0";
const BI_MAGENTA = "#E4177F";

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const up = delta > 0;
  const neutral = delta === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        neutral
          ? "bg-gray-100 text-gray-500"
          : up
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      {!neutral && (up ? "▲" : "▼")}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function MetricCard({ metric }: { metric: ReportPeriodMetric }) {
  const val =
    metric.current == null
      ? "—"
      : `${metric.valuePrefix ?? ""}${metric.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric.valueSuffix ?? ""}`;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-2">
      <p className="text-xs text-gray-500">{metric.label}</p>
      <p className="text-2xl font-bold text-gray-900">{val}</p>
      {metric.previous != null && (
        <div className="flex items-center gap-1.5">
          <DeltaBadge delta={metric.deltaPercent ?? null} />
          <span className="text-[10px] text-gray-400">vs prior period</span>
        </div>
      )}
    </div>
  );
}

type Props = {
  report: ClientReportModel;
  config: ReportConfig;
  draft: ReportDraft | null;
};

export default function ReportPreview({ report, config, draft }: Props) {
  const mainRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function sectionVisible(key: string): boolean {
    const s = config.sections.find((sec) => sec.key === key);
    return s ? s.visible : false;
  }

  function SectionComment({ sectionKey }: { sectionKey: string }) {
    const note = draft?.section_comments?.[sectionKey];
    if (!note?.trim()) return null;
    return (
      <p
        className="mt-3 rounded-lg border-l-4 pl-3 py-2 text-xs italic text-gray-600"
        style={{ borderColor: BI_PURPLE }}
      >
        {note}
      </p>
    );
  }

  async function downloadPdf() {
    if (!mainRef.current || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(mainRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        ignoreElements: (el) => el.classList.contains("no-print"),
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let remaining = imgH;
      let offset = 0;
      pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        offset -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
        remaining -= pageH;
      }
      const slug = report.client.account_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      pdf.save(`bip-report-${slug}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  const { ads, searchConsole, ga4, keywords } = report.channels;

  const kpisSection = config.sections.find((s) => s.key === "kpis");
  const kpisVisible = kpisSection?.visible ?? false;

  const adsSubsection = kpisSection?.key === "kpis"
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
  const ga4Metrics = ga4.metrics.filter((m) => m.current != null && m.current !== 0);

  const hasAds = adsMetrics.length > 0;
  const hasGsc = gscMetrics.length > 0;
  const hasGa4 = ga4Metrics.length > 0;
  const hasKeywords = keywords.rows.length > 0;
  const hasGscTopPages = report.gscTopPages.length > 0;
  const gscMaxClicks = Math.max(...report.gscTopPages.map((p) => p.clicks), 1);

  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const socialWindow = report.socialDailyRows.filter(
    (r) => new Date(r.snapshot_date).getTime() >= cutoff30,
  );
  const socialTotals = socialWindow.reduce(
    (acc, r) => ({
      reach: acc.reach + (r.reach ?? 0),
      engagement: acc.engagement + (r.engagement ?? 0),
      impressions: acc.impressions + (r.impressions ?? 0),
      linkClicks: acc.linkClicks + (r.link_clicks ?? 0),
      follows: acc.follows + (r.follows ?? 0),
    }),
    { reach: 0, engagement: 0, impressions: 0, linkClicks: 0, follows: 0 },
  );
  const hasSocialData =
    socialWindow.length > 0 &&
    socialTotals.reach +
      socialTotals.impressions +
      socialTotals.engagement +
      socialTotals.follows +
      socialTotals.linkClicks >
      0;

  const hasAnyData =
    hasAds || hasGsc || hasGa4 || hasGscTopPages || hasKeywords || hasSocialData;
  function subsectionVisible(subKey: string) {
    if (!kpisSection || kpisSection.key !== "kpis") return true;
    const sub = kpisSection.subsections.find((s) => s.key === subKey);
    return sub ? sub.visible : true;
  }

  return (
    <main ref={mainRef} className="mx-auto max-w-4xl space-y-8 px-8 py-6 text-gray-800 bg-white min-h-full">

      {/* ── Header ── */}
      <header className="rounded-2xl overflow-hidden shadow-sm">
        <div
          className="h-2 w-full"
          style={{ background: `linear-gradient(90deg, ${BI_BLUE}, ${BI_PURPLE}, ${BI_MAGENTA})` }}
        />
        <div className="border border-t-0 border-gray-200 rounded-b-2xl px-7 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${BI_BLUE}, ${BI_PURPLE})` }}
                >
                  B
                </div>
                <span className="text-sm font-semibold tracking-tight" style={{ color: BI_BLUE }}>
                  Beyond Indigo Pets
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Client Performance Report</h1>
              <p className="mt-0.5 text-base font-medium" style={{ color: BI_PURPLE }}>
                {report.client.account_name}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              <p>{draft?.window_label ?? report.reportingWindowLabel}</p>
              <p>Generated: {new Date(report.generatedAt).toLocaleDateString()}</p>
              <p>Strategist: {report.client.marketing_strategist || "Unassigned"}</p>
            </div>
          </div>
          <div className="no-print mt-4 flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={exporting}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
              style={{ borderColor: BI_BLUE, color: BI_BLUE }}
            >
              {exporting ? "Generating PDF…" : "Download PDF"}
            </button>
            {exportError && (
              <p className="text-xs text-red-600 max-w-xs text-right">{exportError}</p>
            )}
          </div>
        </div>
      </header>

      {/* ── From your strategist ── */}
      {draft?.narrative && (
        <section className="rounded-2xl border border-gray-200 px-7 py-6">
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: BI_BLUE }}
          >
            From your strategist
          </h2>
          <p className="text-sm leading-6 text-gray-700 whitespace-pre-line">{draft.narrative}</p>
        </section>
      )}

      {/* ── Performance Overview ── */}
      {kpisVisible && (hasGsc || hasAds || hasGa4) && (
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: BI_BLUE }}
          >
            Performance Overview
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Key metrics for {draft?.window_label ?? report.reportingWindowLabel} · changes vs prior
            period
          </p>

          {hasGsc && subsectionVisible("organic_search") && (
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Organic Search
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {gscMetrics.map((m) => (
                  <MetricCard key={m.label} metric={m} />
                ))}
              </div>
            </div>
          )}

          {hasGa4 && subsectionVisible("ga4") && (
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Website Traffic
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ga4Metrics.map((m) => (
                  <MetricCard key={m.label} metric={m} />
                ))}
              </div>
            </div>
          )}

          {hasAds && subsectionVisible("google_ads") && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Google Ads
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {adsMetrics.map((m) => (
                  <MetricCard key={m.label} metric={m} />
                ))}
              </div>
            </div>
          )}

          <SectionComment sectionKey="kpis" />
        </section>
      )}

      {/* ── Search Traffic — Top Pages ── */}
      {sectionVisible("gsc_top_pages") && hasGscTopPages && (
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: BI_BLUE }}
          >
            Search Traffic
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Your top-performing pages in organic search this period
          </p>

          <div className="rounded-2xl border border-gray-200 px-6 py-5">
            <div className="space-y-2.5">
              {report.gscTopPages.map((page) => {
                const pct = Math.round((page.clicks / gscMaxClicks) * 100);
                const label = page.page_url.replace(/^https?:\/\/[^/]+/, "") || "/";
                return (
                  <div
                    key={page.page_url}
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 44px" }}
                  >
                    <span className="truncate text-xs text-gray-700" title={page.page_url}>
                      {label}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: BI_BLUE }}
                      />
                    </div>
                    <span className="text-right text-xs text-gray-500">
                      {page.clicks.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
              {[
                {
                  label: "Total clicks",
                  value: report.gscTopPages.reduce((s, p) => s + p.clicks, 0).toLocaleString(),
                },
                {
                  label: "Total impressions",
                  value: report.gscTopPages
                    .reduce((s, p) => s + p.impressions, 0)
                    .toLocaleString(),
                },
                {
                  label: "Avg position",
                  value: (
                    report.gscTopPages.reduce((s, p) => s + p.position, 0) /
                    report.gscTopPages.length
                  ).toFixed(1),
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <SectionComment sectionKey="gsc_top_pages" />
        </section>
      )}

      {/* ── Keyword Rankings ── */}
      {sectionVisible("keywords") && hasKeywords && (
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: BI_BLUE }}
          >
            Keyword Rankings
          </h2>
          <p className="text-xs text-gray-400 mb-4">{keywords.summary}</p>
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="px-5 pb-3 pt-3 pr-4">Keyword</th>
                  <th className="px-3 pb-3 pt-3 text-right">Position</th>
                  <th className="px-3 pb-3 pt-3 text-right">Change</th>
                  <th className="px-5 pb-3 pt-3 text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {keywords.rows.map((row) => {
                  const delta = row.positionDelta;
                  const improved = delta != null && delta < 0;
                  const worsened = delta != null && delta > 0;
                  return (
                    <tr key={row.keyword} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 pr-4">
                        <span className="font-medium text-gray-800">{row.keyword}</span>
                        {row.tag && (
                          <span className="ml-2 text-[10px] text-gray-400">{row.tag}</span>
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
                              improved
                                ? "bg-emerald-50 text-emerald-700"
                                : worsened
                                ? "bg-red-50 text-red-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {improved ? "▲" : worsened ? "▼" : "—"}
                            {Math.abs(delta).toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-500">
                        <span className="font-medium text-gray-800">
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
          <SectionComment sectionKey="keywords" />
        </section>
      )}

      {/* ── Social Media ── */}
      {sectionVisible("social") && hasSocialData && (
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: BI_BLUE }}
          >
            Social Media
          </h2>
          <p className="text-xs text-gray-400 mb-4">30-day totals across connected platforms</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "People reached", value: socialTotals.reach },
              { label: "Engagements", value: socialTotals.engagement },
              { label: "Impressions", value: socialTotals.impressions },
              { label: "Link clicks", value: socialTotals.linkClicks },
              { label: "New followers", value: socialTotals.follows },
            ]
              .filter((s) => s.value > 0)
              .map((stat) => (
                <div key={stat.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              ))}
          </div>

          {report.topSocialPosts.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Recent top posts
              </p>
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-2.5">Platform</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Caption</th>
                      <th className="px-4 py-2.5 text-right">Impressions</th>
                      <th className="px-4 py-2.5 text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topSocialPosts.map((post) => (
                      <tr key={post.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2.5 capitalize text-gray-700 text-xs">{post.platform}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {post.published_at ? new Date(post.published_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 text-xs max-w-xs">
                          {post.permalink ? (
                            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="hover:underline line-clamp-2">
                              {post.caption?.slice(0, 120) ?? "(no caption)"}
                            </a>
                          ) : (
                            <span className="line-clamp-2">{post.caption?.slice(0, 120) ?? "(no caption)"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-700">
                          {post.impressions?.toLocaleString() ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-700">
                          {post.engagement?.toLocaleString() ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <SectionComment sectionKey="social" />
        </section>
      )}

      {/* ── Empty state ── */}
      {!hasAnyData && (
        <section className="rounded-2xl border border-gray-200 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No reporting data synced yet for this client.</p>
          <p className="mt-1 text-xs text-gray-400">
            Use the Sync tab on the left to pull fresh data from connected channels.
          </p>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 pt-4 pb-8 flex items-center justify-between text-xs text-gray-400">
        <span style={{ color: BI_BLUE }} className="font-medium">
          Beyond Indigo Pets
        </span>
        <span>Confidential · {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
