"use client";
import {
  AlertCircle,
  Globe,
  Link2Off,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import type {
  AdsSignal,
  AdsSnapshot,
  Ga4Snapshot,
  ClientKeywordTarget,
  KeywordHealthRow,
  ReportingFreshnessItem,
  ReportingKpiCard,
} from "@/lib/types/client";
function kpiValue(
  kpis: Map<string, ReportingKpiCard>,
  id: string,
  fallback = "Not synced",
) {
  const value = kpis.get(id)?.value;
  if (
    !value ||
    value === "Not synced" ||
    value === "Not connected" ||
    value === "Not available"
  ) {
    return fallback;
  }
  return value;
}
function buildPpcMetrics(
  kpis: Map<string, ReportingKpiCard>,
  adsSnapshot: AdsSnapshot | null,
) {
  const totals = adsSnapshot?.totals;
  const spend =
    kpiValue(kpis, "ads-cost-30d") !== "Not synced"
      ? kpiValue(kpis, "ads-cost-30d")
      : totals
        ? `$${(totals.cost_micros / 1_000_000).toFixed(2)}`
        : "Not synced";
  const clicks =
    kpiValue(kpis, "ads-clicks") !== "Not synced"
      ? kpiValue(kpis, "ads-clicks")
      : totals
        ? totals.clicks.toLocaleString("en-US")
        : "Not synced";
  const avgCpc =
    kpiValue(kpis, "ads-cpc-30d") !== "Not synced"
      ? kpiValue(kpis, "ads-cpc-30d")
      : totals
        ? `$${(totals.average_cpc / 1_000_000).toFixed(2)}`
        : "Not synced";
  const searchShare =
    kpiValue(kpis, "ads-search-impression-share") !== "Not synced"
      ? kpiValue(kpis, "ads-search-impression-share")
      : totals && typeof totals.search_impression_share === "number"
        ? `${(totals.search_impression_share * 100).toFixed(2)}%`
        : "Not synced";
  return { spend, clicks, avgCpc, searchShare };
}
function buildSeoMetrics(
  kpis: Map<string, ReportingKpiCard>,
  keywordTargets: ClientKeywordTarget[],
  keywordHealthRows: KeywordHealthRow[],
) {
  const impressions = kpiValue(kpis, "gsc-impressions");
  const trackedCount = keywordTargets.length;
  const indexedCount =
    keywordHealthRows.length > 0
      ? keywordHealthRows.filter(
          (row) => row.current_impressions > 0 || row.current_clicks > 0,
        ).length
      : keywordTargets.filter((row) => row.is_active).length;
  return { impressions, indexedCount, trackedCount };
}
function buildConnectionIssues(freshness: ReportingFreshnessItem[]) {
  return freshness
    .filter((item) => item.status === "missing" || item.status === "stale")
    .map((item) => ({
      id: item.source,
      label: item.label,
      message:
        item.status === "missing"
          ? item.source === "ga4"
            ? "Not Connected"
            : "Not Synced"
          : "Sync Stale",
    }));
}
function buildQualityAlerts(adsSignals: AdsSignal[]) {
  const matches = adsSignals.filter((signal) =>
    /ad relevance|expected ctr/i.test(signal.title),
  );
  const rollups = matches.filter((signal) =>
    signal.signal_id.includes("rollup"),
  );
  if (rollups.length > 0) return rollups;
  return matches.slice(0, 4);
}
export default function ReportingCanvas({
  allKpis,
  adsSnapshot = null,
  ga4Snapshot = null,
  adsSignals = [],
  keywordTargets = [],
  keywordHealthRows = [],
  freshness,
  urgencyScore,
  runningSync = false,
  syncMessage,
  onRunAllSync,
  onGenerateReport,
}: {
  allKpis: ReportingKpiCard[];
  adsSnapshot?: AdsSnapshot | null;
  ga4Snapshot?: Ga4Snapshot | null;
  adsSignals?: AdsSignal[];
  keywordTargets?: ClientKeywordTarget[];
  keywordHealthRows?: KeywordHealthRow[];
  freshness: ReportingFreshnessItem[];
  urgencyScore: number;
  runningSync?: boolean;
  syncMessage?: string | null;
  onRunAllSync?: () => void;
  onGenerateReport?: () => void;
}) {
  const kpiById = useMemo(() => {
    const map = new Map<string, ReportingKpiCard>();
    for (const kpi of allKpis) map.set(kpi.id, kpi);
    return map;
  }, [allKpis]);
  const ppc = useMemo(
    () => buildPpcMetrics(kpiById, adsSnapshot),
    [kpiById, adsSnapshot],
  );
  const seo = useMemo(
    () => buildSeoMetrics(kpiById, keywordTargets, keywordHealthRows),
    [kpiById, keywordTargets, keywordHealthRows],
  );
  const connectionIssues = useMemo(
    () => buildConnectionIssues(freshness),
    [freshness],
  );
  const qualityAlerts = useMemo(
    () => buildQualityAlerts(adsSignals),
    [adsSignals],
  );
  return (
    <div className="space-y-6 bg-bip-card p-6 font-sans text-bip-text">
      
      <header className="flex flex-col items-start justify-between gap-4 border-b border-bip-border pb-4 md:flex-row md:items-center">
        
        <div>
          
          <h2 className="text-xl font-bold tracking-tight">
            Unified Reporting
          </h2>
          <p className="mt-1 text-sm text-bip-muted">
            
            Cross-channel rollup · last 30 days · urgency {urgencyScore}
            /100
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          
          {onGenerateReport && (
            <button
              type="button"
              onClick={onGenerateReport}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:brightness-110/20"
            >
              
              Generate PDF Report
            </button>
          )}
          {onRunAllSync && (
            <button
              type="button"
              onClick={onRunAllSync}
              disabled={runningSync}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text transition hover:bg-bip-card disabled:opacity-60"
            >
              
              {runningSync ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Run all syncs
            </button>
          )}
        </div>
      </header>
      {syncMessage && <p className="text-xs text-bip-muted">{syncMessage}</p>}
      <section className="mb-8">
        
        <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bip-accent">
          
          <Target size={16} /> Paid Search Analytics (Google Ads)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          <MetricTile label="Total Spend" value={ppc.spend} />
          <MetricTile label="Total Clicks" value={ppc.clicks} />
          <MetricTile label="Average CPC" value={ppc.avgCpc} accent="indigo" />
          <MetricTile
            label="Search Impression Share"
            value={ppc.searchShare}
            accent="emerald"
          />
        </div>
      </section>
      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bip-accent">
          <Globe size={16} /> Website Analytics (GA4)
        </h3>
        {!ga4Snapshot ? (
          <p className="rounded-xl border border-dashed border-bip-border p-5 text-sm text-bip-muted">
            No GA4 snapshot synced yet. Run a sync to populate website analytics.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Sessions (30d)" value={gaCount(ga4Snapshot.totals?.sessions)} />
              <MetricTile label="Users (30d)" value={gaCount(ga4Snapshot.totals?.users)} accent="indigo" />
              <MetricTile label="Engagement Rate" value={gaPct(ga4Snapshot.totals?.engagement_rate)} accent="emerald" />
              <MetricTile label="Avg Engagement Time" value={formatGa4Time(ga4Snapshot.totals?.avg_engagement_time_seconds)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Engaged Sessions" value={gaCount(ga4Snapshot.totals?.engaged_sessions)} />
              <MetricTile label="Bounce Rate" value={gaPct(ga4Snapshot.totals?.bounce_rate)} />
              <MetricTile label="Conversion Rate" value={gaPct(ga4Snapshot.totals?.session_key_event_rate)} accent="emerald" />
              <MetricTile label="Avg Session Duration" value={formatGa4Time(ga4Snapshot.totals?.avg_session_duration_seconds)} />
            </div>
            {(ga4Snapshot.channel_breakdown ?? []).length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-bip-border">
                <table className="w-full text-sm">
                  <thead className="bg-bip-card/50 text-[11px] uppercase tracking-wide text-bip-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Channel</th>
                      <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                      <th className="px-3 py-2 text-right font-semibold">Users</th>
                      <th className="px-4 py-2 text-right font-semibold">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ga4Snapshot.channel_breakdown ?? []).slice(0, 8).map((row) => (
                      <tr key={row.channel} className="border-t border-bip-border">
                        <td className="px-4 py-2 text-bip-text">{row.channel}</td>
                        <td className="px-3 py-2 text-right text-bip-muted">{gaCount(row.sessions)}</td>
                        <td className="px-3 py-2 text-right text-bip-muted">{gaCount(row.users)}</td>
                        <td className="px-4 py-2 text-right text-bip-muted">{gaPct(row.engagement_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(ga4Snapshot.top_pages ?? []).length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-bip-border">
                <table className="w-full text-sm">
                  <thead className="bg-bip-card/50 text-[11px] uppercase tracking-wide text-bip-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Top Page</th>
                      <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                      <th className="px-3 py-2 text-right font-semibold">Engagement</th>
                      <th className="px-4 py-2 text-right font-semibold">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ga4Snapshot.top_pages ?? []).slice(0, 8).map((row) => (
                      <tr key={row.page_path} className="border-t border-bip-border">
                        <td className="max-w-[240px] truncate px-4 py-2 text-bip-text" title={row.page_path}>{row.page_path}</td>
                        <td className="px-3 py-2 text-right text-bip-muted">{gaCount(row.sessions)}</td>
                        <td className="px-3 py-2 text-right text-bip-muted">{gaPct(row.engagement_rate)}</td>
                        <td className="px-4 py-2 text-right text-bip-muted">{formatGa4Time(row.avg_engagement_time_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Ga4CanvasTable
              title="Conversions by Event"
              headers={["Event", "Conversions"]}
              rows={(ga4Snapshot.conversions_by_event ?? []).slice(0, 10).map((r) => [r.event_name, gaCount(r.conversions)])}
            />
            <Ga4CanvasTable
              title="Geography"
              headers={["Location", "Sessions", "Users"]}
              rows={(ga4Snapshot.geo_breakdown ?? []).slice(0, 10).map((r) => [
                [r.city, r.region].filter(Boolean).join(", ") || "(not set)",
                gaCount(r.sessions),
                gaCount(r.users),
              ])}
            />
            <Ga4CanvasTable
              title="Device"
              headers={["Device", "Sessions", "Engagement"]}
              rows={(ga4Snapshot.device_breakdown ?? []).map((r) => [r.device || "(unknown)", gaCount(r.sessions), gaPct(r.engagement_rate)])}
            />
            <Ga4CanvasTable
              title="Source / Medium"
              headers={["Source / Medium", "Sessions", "Conversions"]}
              rows={(ga4Snapshot.source_medium_breakdown ?? []).slice(0, 10).map((r) => [r.source_medium || "(not set)", gaCount(r.sessions), gaCount(r.conversions)])}
            />
            <Ga4CanvasTable
              title="New vs Returning"
              headers={["Visitor Type", "Sessions", "Users"]}
              rows={(ga4Snapshot.new_vs_returning ?? []).map((r) => [r.cohort, gaCount(r.sessions), gaCount(r.users)])}
            />
            <Ga4CanvasTable
              title="Landing Pages"
              headers={["Landing Page", "Sessions", "Engagement"]}
              rows={(ga4Snapshot.landing_pages ?? []).slice(0, 10).map((r) => [r.landing_page, gaCount(r.sessions), gaPct(r.engagement_rate)])}
            />
          </>
        )}
      </section>
      <section className="mb-8">

        <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bip-accent">

          <TrendingUp size={16} /> Organic Search &amp; Reach Performance
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <MetricTile label="Global Impressions" value={seo.impressions} />
          <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
            
            <p className="text-xs text-bip-muted">Keyword Index Count</p>
            <div className="mt-1 flex items-baseline gap-2">
              
              <span className="text-2xl font-bold text-bip-text">
                
                {seo.indexedCount.toLocaleString("en-US")}
              </span>
              <span className="text-xs text-bip-muted">
                
                / {seo.trackedCount.toLocaleString("en-US")} tracked
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
        
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
          
          <Link2Off size={16} /> System Sync Alerts &amp; Disconnects
        </h4>
        <div className="grid grid-cols-1 gap-4 text-sm text-bip-muted md:grid-cols-2">
          
          <div className="space-y-2">
            
            {connectionIssues.length === 0 ? (
              <p className="text-xs text-bip-muted">
                All monitored channels are connected.
              </p>
            ) : (
              connectionIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-2 rounded border border-bip-border bg-bip-card/40 p-2 text-xs"
                >
                  
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  {issue.label}: {issue.message}
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            
            {qualityAlerts.length === 0 ? (
              <p className="text-xs text-bip-muted">
                No ad quality score warnings detected.
              </p>
            ) : (
              qualityAlerts.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-400"
                >
                  
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{signal.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
// Real GA4 snapshots can have undefined totals/row fields — guard everything.
function gaNum(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function gaCount(v: number | null | undefined): string {
  const n = gaNum(v);
  return n == null ? "—" : n.toLocaleString("en-US");
}
function gaPct(v: number | null | undefined): string {
  const n = gaNum(v);
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}
function Ga4CanvasTable({
  title, headers, rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">{title}</p>
      <div className="overflow-hidden rounded-xl border border-bip-border">
        <table className="w-full text-sm">
          <thead className="bg-bip-card/50 text-[11px] uppercase tracking-wide text-bip-muted">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-bip-border">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-2 ${ci === 0 ? "max-w-[240px] truncate text-bip-text" : "text-right text-bip-muted"}`}
                    title={ci === 0 ? c : undefined}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatGa4Time(seconds: number | null | undefined): string {
  const n = gaNum(seconds);
  if (n == null) return "—";
  const total = Math.round(n);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "indigo" | "emerald";
}) {
  const valueClass =
    accent === "indigo"
      ? "text-bip-accent"
      : accent === "emerald"
        ? "text-bip-accent"
        : value === "Not synced" || value === "Not connected"
          ? "text-bip-muted"
          : "text-bip-text";
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
      
      <p className="text-xs text-bip-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
