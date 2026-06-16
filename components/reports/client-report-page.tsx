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
export default function ClientReportPage({
  report,
}: {
  report: ClientReportModel;
}) {
  const gains = report.perfRows
    .filter((row) => (row.deltaPercent ?? 0) > 0)
    .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0))
    .slice(0, 3);
  const dips = report.perfRows
    .filter((row) => (row.deltaPercent ?? 0) < 0)
    .sort((a, b) => (a.deltaPercent ?? 0) - (b.deltaPercent ?? 0))
    .slice(0, 3);
  const fmtDelta = (value: number | null) =>
    value == null ? "N/A" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8 print:max-w-none print:p-0">
      
      <style>{` @media print { .report-no-print { display: none !important; } .report-break-before { break-before: page; page-break-before: always; } } `}</style>
      <header className="rounded-2xl border border-white/[0.08] bg-bip-card p-6 shadow-none print:shadow-none">
        
        <div className="flex flex-wrap items-start justify-between gap-4">
          
          <div>
            
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              BIP Active Manager
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Client Performance Report
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {report.client.account_name}
            </p>
          </div>
          <div className="text-right text-sm text-white/75">
            
            <p>Window: {report.reportingWindowLabel}</p>
            <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
            <p>
              Strategist: {report.client.marketing_strategist || "Unassigned"}
            </p>
          </div>
        </div>
        <div className="report-no-print mt-4 flex justify-end">
          
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-white/[0.12] px-3 py-2 text-sm font-medium text-white/75 hover:bg-bip-page"
          >
            
            Print / Save as PDF
          </button>
        </div>
      </header>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          Executive Summary
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          {report.summaryText.split("\n").slice(0, 6).join("")}
        </p>
        <p className="mt-2 text-xs text-white/50">
          
          Overall delta:{""}
          {report.executiveSummary.overallDeltaPercent == null
            ? "N/A"
            : `${report.executiveSummary.overallDeltaPercent.toFixed(1)}%`}
        </p>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          KPI Snapshot
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          
          {report.kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-xl border border-white/[0.08] p-3"
            >
              
              <p className="text-xs text-white/50">{kpi.label}</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {kpi.value}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          Gains Highlights / Performance Dips
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          
          <div>
            
            <p className="text-sm font-medium text-emerald-700">
              Top Gains
            </p>
            <ul className="mt-2 space-y-2 text-sm text-white/75">
              
              {gains.length === 0 ? (
                <li>No gains with prior-period comparison.</li>
              ) : null}
              {gains.map((row) => (
                <li
                  key={row.label}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-300"
                >
                  
                  <div className="flex items-center justify-between gap-2">
                    
                    <span>{row.label}</span>
                    <span>{fmtDelta(row.deltaPercent)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            
            <p className="text-sm font-medium text-red-700">Top Dips</p>
            <ul className="mt-2 space-y-2 text-sm text-white/75">
              
              {dips.length === 0 ? (
                <li>No dips with prior-period comparison.</li>
              ) : null}
              {dips.map((row) => (
                <li
                  key={row.label}
                  className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-400"
                >
                  
                  <div className="flex items-center justify-between gap-2">
                    
                    <span>{row.label}</span>
                    <span>{fmtDelta(row.deltaPercent)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6 report-break-before">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          Detailed Breakdown
        </h2>
        <div className="mt-4 overflow-x-auto">
          
          <table className="w-full min-w-[640px] border-collapse text-sm"><thead><tr className="border-b border-white/[0.08] text-left text-xs uppercase tracking-wide text-white/50"><th className="px-2 py-2">Metric</th><th className="px-2 py-2 text-right">Current</th><th className="px-2 py-2 text-right">Previous</th><th className="px-2 py-2 text-right">% Change</th></tr></thead><tbody>{report.perfRows.map((row) => (
                <tr key={row.label} className="border-b border-zinc-100"><td className="px-2 py-2 text-white">{row.label}</td><td className="px-2 py-2 text-right">
                    {Math.round(row.current).toLocaleString()}
                  </td><td className="px-2 py-2 text-right">
                    {row.previous == null
                      ? "N/A"
                      : Math.round(row.previous).toLocaleString()}
                  </td><td className="px-2 py-2 text-right">
                    {row.deltaPercent == null
                      ? "N/A"
                      : `${row.deltaPercent.toFixed(1)}%`}
                  </td></tr>
              ))}
            </tbody></table>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          
          <div className="h-56">
            
            <p className="mb-2 text-xs font-medium text-white/75">
              Trend (line)
            </p>
            <ResponsiveContainer>
              
              <LineChart data={report.charts.trendData}>
                
                <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="date" />
                <YAxis /> <Tooltip />
                <Line type="monotone" dataKey="engagement" stroke="#2563eb" />
                <Line type="monotone" dataKey="reach" stroke="#7c3aed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-56">
            
            <p className="mb-2 text-xs font-medium text-white/75">
              Channel comparison (bar)
            </p>
            <ResponsiveContainer>
              
              <BarChart data={report.charts.channelData}>
                
                <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="name" />
                <YAxis /> <Tooltip />
                <Bar dataKey="value" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-56 md:col-span-2">
            
            <p className="mb-2 text-xs font-medium text-white/75">
              Gains vs dips (waterfall-style)
            </p>
            <ResponsiveContainer>
              
              <BarChart data={report.charts.waterfallData}>
                
                <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="name" />
                <YAxis /> <Tooltip />
                <Bar dataKey="value">
                  
                  {report.charts.waterfallData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          
          Analyst Detail By Channel
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          
          {(
            [
              report.channels.ga4,
              report.channels.ads,
              report.channels.searchConsole,
            ] as const
          ).map((channel) => (
            <article
              key={channel.source}
              className="rounded-xl border border-white/[0.08] p-3"
            >
              
              <div className="flex items-center justify-between gap-2">
                
                <p className="text-sm font-medium text-white">
                  {channel.title}
                </p>
                <span className="text-[11px] uppercase text-white/50">
                  {channel.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/50">{channel.summary}</p>
              <ul className="mt-2 space-y-1 text-xs text-white/75">
                
                {channel.metrics.length === 0 ? (
                  <li>No period metrics available.</li>
                ) : null}
                {channel.metrics.map((metric) => (
                  <li key={metric.label} className="flex justify-between gap-2">
                    
                    <span className="truncate">{metric.label}</span>
                    <span className="text-right">
                      
                      {metric.current == null
                        ? "N/A"
                        : `${metric.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric.valueSuffix ?? ""}`}
                      {metric.previous != null ? (
                        <span className="ml-1 text-white/50">
                          
                          ({fmtDelta(metric.deltaPercent)})
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          
          Keyword Tracking
        </h2>
        <p className="mt-1 text-xs text-white/50">
          {report.channels.keywords.summary}
        </p>
        <div className="mt-3 overflow-x-auto">
          
          <table className="w-full min-w-[720px] border-collapse text-sm"><thead><tr className="border-b border-white/[0.08] text-left text-xs uppercase tracking-wide text-white/50"><th className="px-2 py-2">Keyword</th><th className="px-2 py-2">Tag</th><th className="px-2 py-2 text-right">Priority</th><th className="px-2 py-2 text-right">Current Pos</th><th className="px-2 py-2 text-right">Prev Pos</th><th className="px-2 py-2 text-right">Delta</th><th className="px-2 py-2 text-right">Clicks</th></tr></thead><tbody>{report.channels.keywords.rows.length === 0 ? (
                <tr><td className="px-2 py-2 text-white/50" colSpan={7}>
                    
                    No managed keywords configured.
                  </td></tr>
              ) : null}
              {report.channels.keywords.rows.map((row) => (
                <tr key={row.keyword} className="border-b border-zinc-100"><td className="px-2 py-2">{row.keyword}</td><td className="px-2 py-2">{row.tag ?? "—"}</td><td className="px-2 py-2 text-right">{row.priority}</td><td className="px-2 py-2 text-right">
                    
                    {row.currentPosition == null
                      ? "N/A"
                      : row.currentPosition.toFixed(1)}
                  </td><td className="px-2 py-2 text-right">
                    
                    {row.previousPosition == null
                      ? "N/A"
                      : row.previousPosition.toFixed(1)}
                  </td><td className="px-2 py-2 text-right">
                    
                    {row.positionDelta == null
                      ? "N/A"
                      : `${row.positionDelta > 0 ? "+" : ""}${row.positionDelta.toFixed(1)}`}
                  </td><td className="px-2 py-2 text-right">
                    
                    {row.currentClicks.toLocaleString()} /
                    {row.previousClicks.toLocaleString()}
                  </td></tr>
              ))}
            </tbody></table>
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-bip-card p-6">
        
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          Strategic Recommendations + Action Queue
        </h2>
        <ol className="mt-3 space-y-2">
          
          {report.recommendations.map((item, index) => (
            <li
              key={`${index}-${item.text}`}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-sm"
            >
              
              <span className="mr-2 inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] uppercase">
                {item.priority}
              </span>
              {item.text}
            </li>
          ))}
        </ol>
        <div className="mt-4 overflow-x-auto">
          
          <table className="w-full min-w-[560px] border-collapse text-sm"><thead><tr className="border-b border-white/[0.08] text-left text-xs uppercase tracking-wide text-white/50"><th className="px-2 py-2">Action</th><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Priority</th></tr></thead><tbody>{report.actions.map((action) => (
                <tr key={action.id} className="border-b border-zinc-100"><td className="px-2 py-2">{action.title}</td><td className="px-2 py-2">{action.owner.replace("_", "")}</td><td className="px-2 py-2">{action.priority}</td></tr>
              ))}
            </tbody></table>
        </div>
      </section>
    </main>
  );
}
