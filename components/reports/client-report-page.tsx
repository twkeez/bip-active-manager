"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClientReportModel } from "@/lib/reporting/types";

// Values that mean "no real data" — hide these rather than display them
const EMPTY_VALUES = new Set([
  "not connected",
  "not synced",
  "coming soon",
  "not available",
  "not enough data",
  "n/a",
]);

function isEmpty(value: string): boolean {
  return EMPTY_VALUES.has(value.toLowerCase().trim());
}

function hasRealData(value: string): boolean {
  if (isEmpty(value)) return false;
  // "0" alone is ambiguous — treat as empty for disconnected sources
  if (value.trim() === "0") return false;
  return true;
}

export default function ClientReportPage({ report }: { report: ClientReportModel }) {
  const gains = report.perfRows
    .filter((r) => (r.deltaPercent ?? 0) > 0)
    .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0))
    .slice(0, 3);
  const dips = report.perfRows
    .filter((r) => (r.deltaPercent ?? 0) < 0)
    .sort((a, b) => (a.deltaPercent ?? 0) - (b.deltaPercent ?? 0))
    .slice(0, 3);

  const fmtDelta = (v: number | null) =>
    v == null ? "N/A" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  // Filter KPIs to only those with real values
  const visibleKpis = report.kpis.filter((k) => hasRealData(k.value));

  // Summary text is real if it's more than the bare template stub
  const hasSummary =
    report.summaryText.trim().length > 40 &&
    !report.summaryText.toLowerCase().includes("overall data:n/a");

  const hasOverallDelta = report.executiveSummary.overallDeltaPercent != null;
  const showExecutiveSummary = hasSummary || hasOverallDelta;

  // Gains/dips section only if there's something to show
  const showGainsDips = gains.length > 0 || dips.length > 0;

  // Detailed breakdown — only rows with a previous value to compare
  const comparableRows = report.perfRows.filter((r) => r.previous != null);
  const showBreakdown = comparableRows.length > 0;

  // Charts — only show if they have non-trivial data
  const hasTrendData = report.charts.trendData.some(
    (d) => d.engagement > 0 || d.reach > 0,
  );
  const hasChannelData = report.charts.channelData.some((d) => d.value > 0);
  const hasWaterfallData = report.charts.waterfallData.some((d) => Math.abs(d.value) > 0);

  // Channel blocks — only show if they have metrics
  const visibleChannels = [
    report.channels.ga4,
    report.channels.ads,
    report.channels.searchConsole,
  ].filter((c) => c.metrics.length > 0);

  const hasKeywords = report.channels.keywords.rows.length > 0;

  const hasRecommendations = report.recommendations.length > 0;
  const hasActions = report.actions.length > 0;
  const showRecommendations = hasRecommendations || hasActions;

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-8 print:max-w-none print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; page-break-before: always; }
        }
      `}</style>

      {/* Header */}
      <header className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              BIP Active Manager
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Client Performance Report
            </h1>
            <p className="mt-0.5 text-sm text-white/60">{report.client.account_name}</p>
          </div>
          <div className="text-right text-xs text-white/50 space-y-0.5">
            <p>Window: {report.reportingWindowLabel}</p>
            <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
            <p>Strategist: {report.client.marketing_strategist || "Unassigned"}</p>
          </div>
        </div>
        <div className="no-print mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-white/[0.12] px-3 py-2 text-sm font-medium text-white/60 hover:text-white transition"
          >
            Print / Save as PDF
          </button>
        </div>
      </header>

      {/* Strategic Recommendations — moved to top so it's seen first */}
      {showRecommendations && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Recommendations &amp; Action Queue
          </h2>
          {hasRecommendations && (
            <ol className="mt-3 space-y-2">
              {report.recommendations.map((item, i) => (
                <li
                  key={`${i}-${item.text}`}
                  className="flex items-start gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-white/80"
                >
                  <span className={`mt-0.5 shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    item.priority === "high"
                      ? "bg-red-500/10 text-red-400"
                      : item.priority === "medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-white/[0.06] text-white/40"
                  }`}>
                    {item.priority}
                  </span>
                  {item.text}
                </li>
              ))}
            </ol>
          )}
          {hasActions && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-white/30">
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {report.actions.map((action) => (
                    <tr key={action.id} className="border-b border-white/[0.04]">
                      <td className="px-2 py-2 text-white/75">{action.title}</td>
                      <td className="px-2 py-2 text-white/50">{action.owner.replace("_", " ")}</td>
                      <td className="px-2 py-2 text-white/50">{action.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Executive Summary — only if there's real content */}
      {showExecutiveSummary && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Executive Summary
          </h2>
          {hasSummary && (
            <p className="mt-2 text-sm leading-6 text-white/75">
              {report.summaryText.split("\n").slice(0, 6).join("")}
            </p>
          )}
          {hasOverallDelta && (
            <p className="mt-2 text-xs text-white/40">
              Overall delta: {report.executiveSummary.overallDeltaPercent!.toFixed(1)}%
            </p>
          )}
        </section>
      )}

      {/* KPI Snapshot — only tiles with real data */}
      {visibleKpis.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            KPI Snapshot
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleKpis.map((kpi) => (
              <article
                key={kpi.id}
                className="rounded-xl border border-white/[0.06] bg-bip-page/30 p-3"
              >
                <p className="text-xs text-white/40">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{kpi.value}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Gains / Dips — only if there's comparison data */}
      {showGainsDips && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Gains &amp; Dips
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500/70">
                Top Gains
              </p>
              <ul className="mt-2 space-y-2">
                {gains.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
                  >
                    <span>{row.label}</span>
                    <span className="font-medium">{fmtDelta(row.deltaPercent)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500/70">
                Top Dips
              </p>
              <ul className="mt-2 space-y-2">
                {dips.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
                  >
                    <span>{row.label}</span>
                    <span className="font-medium">{fmtDelta(row.deltaPercent)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Detailed Breakdown — only comparable rows + charts with data */}
      {showBreakdown && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6 page-break">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Detailed Breakdown
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-white/30">
                  <th className="px-2 py-2">Metric</th>
                  <th className="px-2 py-2 text-right">Current</th>
                  <th className="px-2 py-2 text-right">Previous</th>
                  <th className="px-2 py-2 text-right">% Change</th>
                </tr>
              </thead>
              <tbody>
                {comparableRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.04]">
                    <td className="px-2 py-2 text-white/75">{row.label}</td>
                    <td className="px-2 py-2 text-right text-white/75">
                      {Math.round(row.current).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right text-white/50">
                      {row.previous == null ? "—" : Math.round(row.previous).toLocaleString()}
                    </td>
                    <td className={`px-2 py-2 text-right text-xs font-medium ${
                      (row.deltaPercent ?? 0) > 0
                        ? "text-emerald-400"
                        : (row.deltaPercent ?? 0) < 0
                        ? "text-red-400"
                        : "text-white/30"
                    }`}>
                      {row.deltaPercent == null ? "—" : `${row.deltaPercent.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Charts — only render if they have real data */}
          {(hasTrendData || hasChannelData || hasWaterfallData) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {hasTrendData && (
                <div className="h-56">
                  <p className="mb-2 text-xs font-medium text-white/50">Trend</p>
                  <ResponsiveContainer>
                    <LineChart data={report.charts.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="engagement" stroke="#2563eb" dot={false} />
                      <Line type="monotone" dataKey="reach" stroke="#7c3aed" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {hasChannelData && (
                <div className="h-56">
                  <p className="mb-2 text-xs font-medium text-white/50">Channel comparison</p>
                  <ResponsiveContainer>
                    <BarChart data={report.charts.channelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#00c9a7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {hasWaterfallData && (
                <div className="h-56 md:col-span-2">
                  <p className="mb-2 text-xs font-medium text-white/50">Gains vs dips</p>
                  <ResponsiveContainer>
                    <BarChart data={report.charts.waterfallData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {report.charts.waterfallData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Analyst Detail by Channel — only channels with metrics */}
      {visibleChannels.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Analyst Detail by Channel
          </h2>
          <div className={`mt-3 grid gap-4 ${visibleChannels.length === 1 ? "" : visibleChannels.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            {visibleChannels.map((channel) => (
              <article
                key={channel.source}
                className="rounded-xl border border-white/[0.06] bg-bip-page/30 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{channel.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-white/30">
                    {channel.status}
                  </span>
                </div>
                {channel.summary && (
                  <p className="mt-1 text-xs text-white/40">{channel.summary}</p>
                )}
                <ul className="mt-3 space-y-1.5">
                  {channel.metrics.map((metric) => (
                    <li key={metric.label} className="flex justify-between gap-2 text-xs">
                      <span className="text-white/50 truncate">{metric.label}</span>
                      <span className="text-white/80 text-right shrink-0">
                        {metric.current == null
                          ? "—"
                          : `${metric.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric.valueSuffix ?? ""}`}
                        {metric.previous != null && (
                          <span className="ml-1 text-white/30">({fmtDelta(metric.deltaPercent)})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Keyword Tracking — only if keywords exist */}
      {hasKeywords && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">
            Keyword Tracking
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-white/30">
                  <th className="px-2 py-2">Keyword</th>
                  <th className="px-2 py-2">Tag</th>
                  <th className="px-2 py-2 text-right">Priority</th>
                  <th className="px-2 py-2 text-right">Current</th>
                  <th className="px-2 py-2 text-right">Previous</th>
                  <th className="px-2 py-2 text-right">Delta</th>
                  <th className="px-2 py-2 text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {report.channels.keywords.rows.map((row) => (
                  <tr key={row.keyword} className="border-b border-white/[0.04]">
                    <td className="px-2 py-2 text-white/75">{row.keyword}</td>
                    <td className="px-2 py-2 text-white/40">{row.tag ?? "—"}</td>
                    <td className="px-2 py-2 text-right text-white/40">{row.priority}</td>
                    <td className="px-2 py-2 text-right text-white/75">
                      {row.currentPosition == null ? "—" : row.currentPosition.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right text-white/40">
                      {row.previousPosition == null ? "—" : row.previousPosition.toFixed(1)}
                    </td>
                    <td className={`px-2 py-2 text-right text-xs ${
                      (row.positionDelta ?? 0) < 0
                        ? "text-emerald-400"
                        : (row.positionDelta ?? 0) > 0
                        ? "text-red-400"
                        : "text-white/30"
                    }`}>
                      {row.positionDelta == null
                        ? "—"
                        : `${row.positionDelta > 0 ? "+" : ""}${row.positionDelta.toFixed(1)}`}
                    </td>
                    <td className="px-2 py-2 text-right text-white/50">
                      {row.currentClicks.toLocaleString()} / {row.previousClicks.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state — when almost nothing has data yet */}
      {visibleKpis.length === 0 && !showBreakdown && visibleChannels.length === 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-10 text-center">
          <p className="text-sm text-white/40">
            No reporting data synced yet for this client.
          </p>
          <p className="mt-1 text-xs text-white/25">
            Connect GA4, Google Ads, and Search Console in the Connections tab to start pulling metrics.
          </p>
        </section>
      )}
    </main>
  );
}
