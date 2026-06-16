"use client";
import {
  AlertCircle,
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
function parseNumericPosition(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function computeVisibilityIndex(avgPosition: number | null) {
  if (avgPosition == null) return "Not synced";
  const index = Math.max(0, Math.min(100, 100 - avgPosition));
  return `${index.toFixed(2)}%`;
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
  const avgPositionRaw = kpis.get("gsc-avg-position-30d")?.value;
  const avgPosition =
    avgPositionRaw && avgPositionRaw !== "Not synced"
      ? parseNumericPosition(avgPositionRaw)
      : null;
  const visibility = computeVisibilityIndex(avgPosition);
  const trackedCount = keywordTargets.length;
  const indexedCount =
    keywordHealthRows.length > 0
      ? keywordHealthRows.filter(
          (row) => row.current_impressions > 0 || row.current_clicks > 0,
        ).length
      : keywordTargets.filter((row) => row.is_active).length;
  return { impressions, visibility, indexedCount, trackedCount };
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
    <div className="space-y-6 bg-bip-card p-6 font-sans text-white">
      
      <header className="flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] pb-4 md:flex-row md:items-center">
        
        <div>
          
          <h2 className="text-xl font-bold tracking-tight">
            Unified Reporting
          </h2>
          <p className="mt-1 text-sm text-white/50">
            
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-bip-card disabled:opacity-60"
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
      {syncMessage && <p className="text-xs text-white/50">{syncMessage}</p>}
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
          
          <TrendingUp size={16} /> Organic Search &amp; Reach Performance
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          
          <MetricTile label="Global Impressions" value={seo.impressions} />
          <MetricTile label="Search Visibility Index" value={seo.visibility} />
          <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
            
            <p className="text-xs text-white/50">Keyword Index Count</p>
            <div className="mt-1 flex items-baseline gap-2">
              
              <span className="text-2xl font-bold text-white">
                
                {seo.indexedCount.toLocaleString("en-US")}
              </span>
              <span className="text-xs text-white/50">
                
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
        <div className="grid grid-cols-1 gap-4 text-sm text-white/50 md:grid-cols-2">
          
          <div className="space-y-2">
            
            {connectionIssues.length === 0 ? (
              <p className="text-xs text-white/50">
                All monitored channels are connected.
              </p>
            ) : (
              connectionIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-2 rounded border border-white/[0.08] bg-bip-card/40 p-2 text-xs"
                >
                  
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  {issue.label}: {issue.message}
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            
            {qualityAlerts.length === 0 ? (
              <p className="text-xs text-white/50">
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
          ? "text-white/50"
          : "text-white";
  return (
    <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
      
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
