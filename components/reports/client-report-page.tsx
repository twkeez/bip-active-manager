"use client";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportDraft } from "@/lib/reporting/draft-types";

// BI brand palette
const BI_BLUE = "#3D52C4";
const BI_PURPLE = "#7B35B0";
const BI_MAGENTA = "#E4177F";

const EMPTY_VALUES = new Set([
  "not connected", "not synced", "coming soon",
  "not available", "not enough data", "n/a",
]);
function hasRealData(v: string) {
  const lower = v.toLowerCase().trim();
  return !EMPTY_VALUES.has(lower) && lower !== "0";
}

type Props = { report: ClientReportModel; draft?: ReportDraft | null };

export default function ClientReportPage({ report, draft }: Props) {
  const vis = draft?.section_visibility ?? {};
  const kpiOverrides = draft?.kpi_overrides ?? {};
  const comments = draft?.section_comments ?? {};

  function isVisible(key: string, defaultOn = true) {
    return key in vis ? Boolean(vis[key]) : defaultOn;
  }

  // Apply KPI overrides + hidden flags
  const visibleKpis = report.kpis
    .filter((k) => hasRealData(k.value))
    .filter((k) => !(kpiOverrides[k.id]?.hidden))
    .map((k) => ({
      ...k,
      value: kpiOverrides[k.id]?.value ?? k.value,
    }));

  const gains = report.perfRows
    .filter((r) => (r.deltaPercent ?? 0) > 0)
    .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0))
    .slice(0, 3);
  const dips = report.perfRows
    .filter((r) => (r.deltaPercent ?? 0) < 0)
    .sort((a, b) => (a.deltaPercent ?? 0) - (b.deltaPercent ?? 0))
    .slice(0, 3);
  const comparableRows = report.perfRows.filter((r) => r.previous != null);
  const visibleChannels = [report.channels.ga4, report.channels.ads, report.channels.searchConsole]
    .filter((c) => c.metrics.length > 0);
  const hasKeywords = report.channels.keywords.rows.length > 0;
  const hasTrendData = report.charts.trendData.some((d) => d.engagement > 0 || d.reach > 0);
  const hasChannelData = report.charts.channelData.some((d) => d.value > 0);
  const hasWaterfallData = report.charts.waterfallData.some((d) => Math.abs(d.value) > 0);
  const hasRecommendations = report.recommendations.length > 0 || report.actions.length > 0;
  const fmtDelta = (v: number | null) =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  function SectionComment({ sectionKey }: { sectionKey: string }) {
    const note = comments[sectionKey];
    if (!note?.trim()) return null;
    return (
      <p className="mt-3 rounded-lg border-l-4 pl-3 py-2 text-xs italic text-gray-600"
        style={{ borderColor: BI_PURPLE }}>
        {note}
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; page-break-before: always; }
          body { background: white !important; }
        }
        body { background: white; }
      `}</style>

      {/* Back link — screen only */}
      <div className="no-print px-8 pt-4">
        <Link
          href={`/reports/${report.client.id}/draft`}
          className="inline-flex items-center gap-1 text-xs hover:underline"
          style={{ color: BI_BLUE }}
        >
          ← Edit draft
        </Link>
      </div>

      <main className="mx-auto max-w-4xl space-y-6 px-8 py-6 print:max-w-none print:px-10 print:py-8 text-gray-800">

        {/* Header — BI branded */}
        <header className="rounded-2xl overflow-hidden shadow-sm">
          {/* Gradient bar */}
          <div
            className="h-2 w-full"
            style={{ background: `linear-gradient(90deg, ${BI_BLUE}, ${BI_PURPLE}, ${BI_MAGENTA})` }}
          />
          <div className="border border-t-0 border-gray-200 rounded-b-2xl px-7 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                {/* Logo mark */}
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
                <p>Window: {draft?.window_label ?? report.reportingWindowLabel}</p>
                <p>Generated: {new Date(report.generatedAt).toLocaleDateString()}</p>
                <p>Strategist: {report.client.marketing_strategist || "Unassigned"}</p>
              </div>
            </div>

            <div className="no-print mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
                style={{ borderColor: BI_BLUE, color: BI_BLUE }}
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </header>

        {/* Strategist narrative */}
        {draft?.narrative && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: BI_BLUE }}>
              From your strategist
            </h2>
            <p className="text-sm leading-6 text-gray-700 whitespace-pre-line">
              {draft.narrative}
            </p>
          </section>
        )}

        {/* Recommendations */}
        {isVisible("recommendations") && hasRecommendations && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              Recommendations &amp; Action Queue
            </h2>
            {report.recommendations.length > 0 && (
              <ol className="space-y-2 mb-4">
                {report.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.priority === "high"
                        ? "text-white"
                        : item.priority === "medium"
                        ? "text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    style={item.priority === "high" ? { background: BI_MAGENTA }
                      : item.priority === "medium" ? { background: BI_PURPLE } : undefined}
                    >
                      {item.priority}
                    </span>
                    {item.text}
                  </li>
                ))}
              </ol>
            )}
            {report.actions.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Owner</th>
                    <th className="pb-2">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {report.actions.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-700">{a.title}</td>
                      <td className="py-2 pr-4 text-gray-500">{a.owner.replace("_", " ")}</td>
                      <td className="py-2 text-gray-500">{a.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <SectionComment sectionKey="recommendations" />
          </section>
        )}

        {/* KPI Snapshot */}
        {isVisible("kpis") && visibleKpis.length > 0 && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              KPI Snapshot
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleKpis.map((kpi) => (
                <div key={kpi.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{kpi.value}</p>
                </div>
              ))}
            </div>
            <SectionComment sectionKey="kpis" />
          </section>
        )}

        {/* Gains & Dips */}
        {isVisible("gains_dips") && (gains.length > 0 || dips.length > 0) && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              Gains &amp; Dips
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">Top Gains</p>
                <ul className="space-y-2">
                  {gains.map((r) => (
                    <li key={r.label} className="flex justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm">
                      <span className="text-gray-700">{r.label}</span>
                      <span className="font-semibold text-emerald-600">{fmtDelta(r.deltaPercent)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">Top Dips</p>
                <ul className="space-y-2">
                  {dips.map((r) => (
                    <li key={r.label} className="flex justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm">
                      <span className="text-gray-700">{r.label}</span>
                      <span className="font-semibold text-red-500">{fmtDelta(r.deltaPercent)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <SectionComment sectionKey="gains_dips" />
          </section>
        )}

        {/* Detailed Breakdown */}
        {isVisible("breakdown") && comparableRows.length > 0 && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5 page-break">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              Detailed Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2 pr-4">Metric</th>
                    <th className="pb-2 pr-4 text-right">Current</th>
                    <th className="pb-2 pr-4 text-right">Previous</th>
                    <th className="pb-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparableRows.map((row) => (
                    <tr key={row.label} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-700">{row.label}</td>
                      <td className="py-2 pr-4 text-right font-medium text-gray-900">
                        {Math.round(row.current).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-500">
                        {row.previous == null ? "—" : Math.round(row.previous).toLocaleString()}
                      </td>
                      <td className={`py-2 text-right text-xs font-semibold ${
                        (row.deltaPercent ?? 0) > 0 ? "text-emerald-600"
                        : (row.deltaPercent ?? 0) < 0 ? "text-red-500"
                        : "text-gray-400"
                      }`}>
                        {fmtDelta(row.deltaPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(hasTrendData || hasChannelData || hasWaterfallData) && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {hasTrendData && (
                  <div className="h-52">
                    <p className="mb-2 text-xs font-medium text-gray-500">Trend</p>
                    <ResponsiveContainer>
                      <LineChart data={report.charts.trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="engagement" stroke={BI_BLUE} dot={false} />
                        <Line type="monotone" dataKey="reach" stroke={BI_PURPLE} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {hasChannelData && (
                  <div className="h-52">
                    <p className="mb-2 text-xs font-medium text-gray-500">Channel comparison</p>
                    <ResponsiveContainer>
                      <BarChart data={report.charts.channelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip />
                        <Bar dataKey="value" fill={BI_BLUE} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {hasWaterfallData && (
                  <div className="h-52 md:col-span-2">
                    <p className="mb-2 text-xs font-medium text-gray-500">Gains vs dips</p>
                    <ResponsiveContainer>
                      <BarChart data={report.charts.waterfallData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
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
            <SectionComment sectionKey="breakdown" />
          </section>
        )}

        {/* Channel Detail */}
        {isVisible("channels") && visibleChannels.length > 0 && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              Channel Detail
            </h2>
            <div className={`grid gap-4 ${
              visibleChannels.length === 1 ? "" : visibleChannels.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
            }`}>
              {visibleChannels.map((channel) => (
                <div key={channel.source} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">{channel.title}</p>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">{channel.status}</span>
                  </div>
                  {channel.summary && (
                    <p className="text-xs text-gray-500 mb-2">{channel.summary}</p>
                  )}
                  <ul className="space-y-1.5">
                    {channel.metrics.map((metric) => (
                      <li key={metric.label} className="flex justify-between text-xs">
                        <span className="text-gray-500 truncate">{metric.label}</span>
                        <span className="font-medium text-gray-800 text-right">
                          {metric.current == null
                            ? "—"
                            : `${metric.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric.valueSuffix ?? ""}`}
                          {metric.previous != null && (
                            <span className="ml-1 text-gray-400">({fmtDelta(metric.deltaPercent)})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <SectionComment sectionKey="channels" />
          </section>
        )}

        {/* Keywords */}
        {isVisible("keywords") && hasKeywords && (
          <section className="rounded-2xl border border-gray-200 px-6 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: BI_BLUE }}>
              Keyword Tracking
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2 pr-4">Keyword</th>
                    <th className="pb-2 pr-4">Tag</th>
                    <th className="pb-2 pr-4 text-right">Current</th>
                    <th className="pb-2 pr-4 text-right">Previous</th>
                    <th className="pb-2 pr-4 text-right">Delta</th>
                    <th className="pb-2 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.channels.keywords.rows.map((row) => (
                    <tr key={row.keyword} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-700">{row.keyword}</td>
                      <td className="py-2 pr-4 text-gray-400">{row.tag ?? "—"}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {row.currentPosition == null ? "—" : row.currentPosition.toFixed(1)}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-400">
                        {row.previousPosition == null ? "—" : row.previousPosition.toFixed(1)}
                      </td>
                      <td className={`py-2 pr-4 text-right text-xs font-semibold ${
                        (row.positionDelta ?? 0) < 0 ? "text-emerald-600"
                        : (row.positionDelta ?? 0) > 0 ? "text-red-500"
                        : "text-gray-400"
                      }`}>
                        {row.positionDelta == null ? "—"
                          : `${row.positionDelta > 0 ? "+" : ""}${row.positionDelta.toFixed(1)}`}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {row.currentClicks.toLocaleString()} / {row.previousClicks.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SectionComment sectionKey="keywords" />
          </section>
        )}

        {/* Empty state */}
        {visibleKpis.length === 0 && comparableRows.length === 0 && visibleChannels.length === 0 && (
          <section className="rounded-2xl border border-gray-200 px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No reporting data synced yet for this client.</p>
            <p className="mt-1 text-xs text-gray-400">
              Connect GA4, Google Ads, and Search Console in the Connections tab to start pulling metrics.
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-4 pb-8 flex items-center justify-between text-xs text-gray-400">
          <span style={{ color: BI_BLUE }} className="font-medium">Beyond Indigo Pets</span>
          <span>Confidential · {new Date().getFullYear()}</span>
        </footer>
      </main>
    </div>
  );
}
