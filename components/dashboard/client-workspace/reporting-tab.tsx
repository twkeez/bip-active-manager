"use client";
import { useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import MarketingUpdateComposer from "@/components/dashboard/marketing-update-composer";
import LocalRankGridPanel from "@/components/local-rank/local-rank-grid-panel";
import ReportingCanvas from "@/components/dashboard/reporting-canvas";
import {
  buildDetailedBreakdownChartData,
  buildKeywordSection,
  buildWeeklyPerformanceRows,
  buildWeeklySummaryText,
} from "@/lib/reporting/build-report";
import type {
  ManagedKeyword,
  ReportingActionItem,
} from "@/lib/reporting/types";
import type {
  ReportingMetricControl,
  ReportingMetricId,
} from "@/lib/reporting/metric-registry";
import type {
  AdsSignal,
  AdsSnapshot,
  Ga4Snapshot,
  ClientKeywordTarget,
  ClientRow,
  GbpSnapshot,
  KeywordHealthRow,
  ReportingAlertItem,
  ReportingFreshnessItem,
  ReportingKpiCard,
  SocialDailySnapshot,
  StrategistSummaryResult,
} from "@/lib/types/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateTime } from "./shared";
import type { FindingSeverity } from "./shared";
function SeverityChip({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${severity === "critical" ? "border border-red-500/20 bg-red-500/10 text-red-400" : "border border-amber-500/20 bg-amber-500/10 text-amber-400"}`}
    >
      
      {severity === "critical" ? "Critical" : "Watch"}
    </span>
  );
}
function reportingSourceLabel(source: ReportingAlertItem["source"]) {
  switch (source) {
    case "ads":
      return "Ads";
    case "search_console":
      return "Search Console";
    case "social":
      return "Social";
    case "seo":
      return "SEO";
    case "sitemaps":
      return "Sitemaps";
    case "gbp":
      return "GBP";
    default:
      return "Internal";
  }
}
export default function ReportingOverview({
  selectedClient,
  allKpis,
  kpis,
  alerts,
  freshness,
  actions,
  urgencyScore,
  staleSources,
  keywordHealthRows,
  selectedSocialDailyRows,
  selectedAdsSnapshot,
  selectedGa4Snapshot,
  selectedAdsSignals,
  keywordHealthLoading,
  keywordHealthError,
  keywordDropTheoryByRow,
  keywordDropTheoryLoadingByRow,
  strategistSummary,
  strategistSummaryGoals,
  strategistSummaryLoading,
  strategistSummaryError,
  runningSync,
  syncMessage,
  gbpSnapshot,
  gbpLoading,
  gbpError,
  gbpSyncDiagnostics,
  onSyncGbp,
  onLoadKeywordHealth,
  onExplainKeywordDrop,
  onGenerateStrategistSummary,
  onChangeStrategistGoals,
  onRunAllSync,
  onGenerateReport,
  keywordTargets,
  keywordTargetsLoading,
  keywordDraftInput,
  onKeywordDraftInputChange,
  onAddKeyword,
  onRemoveKeyword,
  managedKeywords,
  metricControls,
  metricPrefsLoading,
  onSaveMetricLayout,
  onResetMetricPrefs,
}: {
  selectedClient: ClientRow | null;
  allKpis: ReportingKpiCard[];
  kpis: ReportingKpiCard[];
  alerts: ReportingAlertItem[];
  freshness: ReportingFreshnessItem[];
  actions: ReportingActionItem[];
  urgencyScore: number;
  staleSources: ReportingFreshnessItem[];
  keywordHealthRows: KeywordHealthRow[];
  selectedSocialDailyRows: SocialDailySnapshot[];
  selectedAdsSnapshot: AdsSnapshot | null;
  selectedGa4Snapshot: Ga4Snapshot | null;
  selectedAdsSignals: AdsSignal[];
  keywordHealthLoading: boolean;
  keywordHealthError: string | null;
  keywordDropTheoryByRow: Record<
    string,
    { theory: string; actionSignals: string[] } | undefined
  >;
  keywordDropTheoryLoadingByRow: Record<string, boolean | undefined>;
  strategistSummary: StrategistSummaryResult | null;
  strategistSummaryGoals: string;
  strategistSummaryLoading: boolean;
  strategistSummaryError: string | null;
  runningSync: boolean;
  syncMessage: string | null;
  gbpSnapshot: GbpSnapshot | null;
  gbpLoading: boolean;
  gbpError: string | null;
  gbpSyncDiagnostics: {
    fetchedReviewCount: number;
    storedReviewCount: number;
    latestReviewTimeUnix: number | null;
    topReviews: Array<{
      authorName: string | null;
      reviewTimeUnix: number | null;
      relativeTimeDescription: string | null;
      rating: number | null;
    }>;
    sourceBreakdown: {
      placesReviewCount: number;
      legacyReviewCount: number;
      gbpApiReviewCount: number;
      matchedGbpLocationCount: number;
      gbpApiError: string | null;
    };
  } | null;
  onSyncGbp?: () => void;
  onLoadKeywordHealth?: () => void;
  onExplainKeywordDrop?: (row: KeywordHealthRow) => void;
  onGenerateStrategistSummary?: () => void;
  onChangeStrategistGoals?: (nextGoals: string) => void;
  onRunAllSync?: () => void;
  onGenerateReport?: () => void;
  keywordTargets: ClientKeywordTarget[];
  keywordTargetsLoading: boolean;
  keywordDraftInput: string;
  onKeywordDraftInputChange: (value: string) => void;
  onAddKeyword?: (keyword: string) => void;
  onRemoveKeyword?: (id: number) => void;
  managedKeywords: ManagedKeyword[];
  metricControls: ReportingMetricControl[];
  metricPrefsLoading: boolean;
  onSaveMetricLayout?: (
    rows: Array<{
      metricId: ReportingMetricId;
      isEnabled: boolean;
      displayOrder: number;
    }>,
  ) => void;
  onResetMetricPrefs?: () => void;
}) {
  const summaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [summaryCopied, setSummaryCopied] = useState<string | null>(null);
  const [strategistCopied, setStrategistCopied] = useState<string | null>(null);
  const criticalAlerts = alerts.filter(
    (alert) => alert.severity === "critical",
  );
  const watchAlerts = alerts.filter((alert) => alert.severity === "watch");
  const gbpRecentReviewCountLabel =
    allKpis.find((metric) => metric.id === "gbp-reviews-30d")?.value ?? "N/A";
  const gbpLastPostLabel = gbpSnapshot?.last_post_at
    ? (() => {
        const days = Math.floor(
          (Date.now() - new Date(gbpSnapshot.last_post_at).getTime()) /
            86_400_000,
        );
        const ago = days === 0 ? "today" : `${days}d ago`;
        return `${new Date(gbpSnapshot.last_post_at).toLocaleDateString()} (${ago})`;
      })()
    : null;
  const gbpProfileMissing = gbpSnapshot?.profile_fields
    ? Object.entries(gbpSnapshot.profile_fields)
        .filter(([, present]) => !present)
        .map(([field]) => field)
    : null;
  const keywordRowsForReport = useMemo<KeywordHealthRow[]>(
    () =>
      managedKeywords.map((keyword) => {
        const matching = keywordHealthRows.filter(
          (row) =>
            row.keyword.trim().toLowerCase() ===
            keyword.keyword.trim().toLowerCase(),
        );
        if (matching.length > 0) return matching[0]!;
        return {
          keyword: keyword.keyword,
          page_url: null,
          current_position: null,
          previous_position: null,
          position_delta: 0,
          current_clicks: 0,
          previous_clicks: 0,
          current_impressions: 0,
          previous_impressions: 0,
          dropped_by_3_plus: false,
        };
      }),
    [managedKeywords, keywordHealthRows],
  );
  const keywordSection = useMemo(
    () =>
      buildKeywordSection({
        managedKeywords,
        gscQueryMetrics: keywordRowsForReport.map((row) => ({
          query: row.keyword,
          clicks: row.current_clicks,
          impressions: row.current_impressions,
          position: row.current_position ?? 0,
          created_at: new Date().toISOString(),
        })),
      }),
    [managedKeywords, keywordRowsForReport],
  );
  const generatedSummary = buildWeeklySummaryText({
    clientName: selectedClient?.account_name ?? "Unknown client",
    website: selectedClient?.website,
    urgencyScore,
    staleSources,
    criticalAlerts,
    watchAlerts,
    actions,
    kpis,
    keywordRows: keywordRowsForReport,
    socialDailyRows: selectedSocialDailyRows,
    adsSnapshot: selectedAdsSnapshot,
    strategistSummary,
  });
  if (!selectedClient) {
    return null;
  }
  const keywordAttentionRows = keywordHealthRows.filter(
    (row) => row.dropped_by_3_plus,
  );
  async function handleCopySummary() {
    const text = summaryTextareaRef.current?.value ?? generatedSummary;
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setSummaryCopied("Summary copied.");
    } catch {
      setSummaryCopied("Could not copy automatically. Please copy manually.");
    }
  }
  async function handleCopyStrategistSummary() {
    if (!strategistSummary) return;
    const text = [
      `The Win: ${strategistSummary.theWin}`,
      `The Concern: ${strategistSummary.theConcern}`,
      `The Next Move: ${strategistSummary.theNextMove}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStrategistCopied("Strategist summary copied.");
    } catch {
      setStrategistCopied(
        "Could not copy automatically. Please copy manually.",
      );
    }
  }
  return (
    <div className="space-y-6 bg-bip-card font-sans text-bip-text">
      
      <ReportingCanvas
        allKpis={allKpis}
        adsSnapshot={selectedAdsSnapshot}
        ga4Snapshot={selectedGa4Snapshot}
        adsSignals={selectedAdsSignals}
        keywordTargets={keywordTargets}
        keywordHealthRows={keywordHealthRows}
        freshness={freshness}
        urgencyScore={urgencyScore}
        runningSync={runningSync}
        syncMessage={syncMessage}
        onRunAllSync={onRunAllSync}
        onGenerateReport={onGenerateReport}
      />
      <section className="rounded-xl border border-bip-border bg-bip-card/50 p-4">
        
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          <div>
            
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
              
              Google Business Profile
            </p>
            <p className="mt-0.5 text-xs text-bip-text">
              
              {gbpSnapshot?.place_name
                ? `${gbpSnapshot.place_name} • ${gbpSnapshot.rating?.toFixed(2) ?? "N/A"} (${gbpSnapshot.user_ratings_total ?? 0} reviews)`
                : "Not synced yet for this client."}
            </p>
          </div>
          {onSyncGbp && (
            <button
              type="button"
              onClick={onSyncGbp}
              disabled={gbpLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-2.5 py-1 text-xs font-medium text-bip-text transition hover:bg-bip-card disabled:opacity-60"
            >
              
              {gbpLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync GBP
            </button>
          )}
        </div>
        {gbpError && <p className="mt-1.5 text-xs text-red-400">{gbpError}</p>}
        <p className="mt-1 text-xs text-bip-muted">

          Recent reviews (30d): {gbpRecentReviewCountLabel}
        </p>
        {gbpSnapshot && (
          <p className="mt-1 text-xs text-bip-muted">
            Last post: {gbpLastPostLabel ?? "No post data synced"}
          </p>
        )}
        {gbpSnapshot && (
          <p className="mt-1 text-xs text-bip-muted">
            Profile completeness:{" "}
            {gbpProfileMissing === null
              ? "Not synced"
              : gbpProfileMissing.length === 0
                ? "Complete"
                : `Missing ${gbpProfileMissing.join(", ")}`}
          </p>
        )}
        {gbpSyncDiagnostics && (
          <>
            
            <p className="mt-1 text-xs text-bip-muted">
              
              Last sync diagnostics: fetched
              {gbpSyncDiagnostics.fetchedReviewCount}, stored{""}
              {gbpSyncDiagnostics.storedReviewCount}, latest{""}
              {gbpSyncDiagnostics.latestReviewTimeUnix
                ? new Date(
                    gbpSyncDiagnostics.latestReviewTimeUnix * 1000,
                  ).toLocaleString()
                : "N/A"}
            </p>
            {gbpSyncDiagnostics.topReviews.length > 0 && (
              <p className="mt-1 text-xs text-bip-muted">
                
                Latest synced reviews:{""}
                {gbpSyncDiagnostics.topReviews
                  .map((row) => {
                    const timeLabel = row.reviewTimeUnix
                      ? new Date(row.reviewTimeUnix * 1000).toLocaleDateString()
                      : row.relativeTimeDescription || "N/A";
                    return `${row.authorName ?? "Unknown"} (${row.rating ?? "?"}★, ${timeLabel})`;
                  })
                  .join(" •")}
              </p>
            )}
            <p className="mt-1 text-xs text-bip-muted">
              
              Source breakdown: Places
              {gbpSyncDiagnostics.sourceBreakdown.placesReviewCount},{""} Legacy
              {gbpSyncDiagnostics.sourceBreakdown.legacyReviewCount}, GBP API
              {""} {gbpSyncDiagnostics.sourceBreakdown.gbpApiReviewCount},
              matched locations{""}
              {gbpSyncDiagnostics.sourceBreakdown.matchedGbpLocationCount}
              {gbpSyncDiagnostics.sourceBreakdown.gbpApiError
                ? `, GBP API error: ${gbpSyncDiagnostics.sourceBreakdown.gbpApiError}`
                : ""}
            </p>
            {gbpSyncDiagnostics.sourceBreakdown.matchedGbpLocationCount === 0 &&
              (gbpSyncDiagnostics.sourceBreakdown.gbpApiError
                ?.toLowerCase()
                .includes("quota exceeded") ? (
                <p className="mt-1 text-xs text-amber-400">
                  
                  GBP API quota is currently exhausted. Wait a minute and retry;
                  until quota recovers, location matching cannot be
                  validated.
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-400">
                  
                  This Google Place ID is not mapped to a GBP location
                  accessible by the current OAuth account. Update the client
                  Google Place ID to the exact GBP-managed listing.
                </p>
              ))}
          </>
        )}
      </section>
      <section className="space-y-2">
        
        <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
          
          Top actions this week
        </p>
        {actions.length === 0 ? (
          <p className="rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text">
            
            No prioritized actions right now.
          </p>
        ) : (
          <ul className="space-y-2">
            
            {actions.map((action) => (
              <li
                key={action.id}
                className="rounded-lg border border-bip-border bg-bip-card px-3 py-2"
              >
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  
                  <p className="text-sm font-medium text-bip-text">
                    
                    {action.title}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${action.priority === "high" ? "border border-red-500/20 bg-red-500/10 text-red-400" : action.priority === "medium" ? "border border-amber-500/20 bg-amber-500/10 text-amber-400" : "bg-bip-fill text-bip-text"}`}
                  >
                    
                    {action.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-bip-text">{action.detail}</p>
                <p className="mt-1 text-[11px] text-bip-muted">
                  
                  Owner: {action.owner.replace("_", "")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-bip-border bg-bip-card p-3">
        
        <div className="mb-2 flex items-center justify-between gap-2">
          
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Managed keywords
          </p>
          {keywordTargetsLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-bip-muted" />
          )}
        </div>
        <p className="text-xs text-bip-muted">{keywordSection.summary}</p>
        <div className="mt-2 flex gap-2">
          
          <input
            value={keywordDraftInput}
            onChange={(event) => onKeywordDraftInputChange(event.target.value)}
            placeholder="Add keyword phrase..."
            className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-xs text-bip-text"
          />
          <button
            type="button"
            onClick={() => onAddKeyword?.(keywordDraftInput)}
            className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill"
          >
            
            Add
          </button>
        </div>
        {keywordTargets.length > 0 ? (
          <ul className="mt-2 space-y-1">
            
            {keywordTargets.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-md border border-bip-border px-2 py-1 text-xs"
              >
                
                <span>{row.keyword}</span>
                <button
                  type="button"
                  onClick={() => onRemoveKeyword?.(row.id)}
                  className="text-bip-muted hover:text-red-600"
                >
                  
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-bip-muted">No tracked keywords yet.</p>
        )}
      </section>
      {selectedClient ? (
        <LocalRankGridPanel
          clientId={selectedClient.id}
          clientName={selectedClient.account_name}
          keywordTargets={keywordTargets}
          googlePlaceId={selectedClient.google_place_id}
        />
      ) : null}
      <section className="rounded-lg border border-bip-border bg-bip-card p-3">
        
        <div className="mb-2 flex items-center justify-between gap-2">
          
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Keyword health (SEO decay tracker)
          </p>
          <button
            type="button"
            onClick={onLoadKeywordHealth}
            disabled={keywordHealthLoading || !onLoadKeywordHealth}
            className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
          >
            
            {keywordHealthLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Refresh keyword health
          </button>
        </div>
        <p className="text-xs text-bip-muted">
          
          Top 20 keywords from Search Console. Comparing last 7 days vs previous
          7 days.
        </p>
        {keywordHealthError && (
          <p className="mt-2 text-sm text-red-600">{keywordHealthError}</p>
        )}
        {keywordAttentionRows.length > 0 && (
          <p className="mt-2 text-sm text-amber-700">
            
            Attention needed: {keywordAttentionRows.length} keyword
            {keywordAttentionRows.length === 1 ? "" : "s"} dropped by 3+
            positions.
          </p>
        )}
        {keywordHealthRows.length === 0 ? (
          <p className="mt-2 text-sm text-bip-text">
            
            No keyword health data yet. Click refresh to load.
          </p>
        ) : (
          <div className="mt-2 overflow-auto rounded-lg border border-bip-border">
            
            <table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead><tr className="border-b border-bip-border bg-bip-page"><th className="px-2 py-2 font-semibold text-bip-text">
                    Keyword
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Page
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Prev pos
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Current pos
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Drop
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Clicks
                  </th><th className="px-2 py-2 font-semibold text-bip-text">
                    Why did this drop?
                  </th></tr></thead><tbody>{keywordHealthRows.map((row) => {
                  const rowKey = `${row.keyword}::${row.page_url ?? ""}`;
                  const theory = keywordDropTheoryByRow[rowKey];
                  const loadingTheory = Boolean(
                    keywordDropTheoryLoadingByRow[rowKey],
                  );
                  return (
                    <tr
                      key={rowKey}
                      className={`border-b border-bip-border ${row.dropped_by_3_plus ? "bg-amber-500/10" : ""}`}
                    ><td className="px-2 py-2 font-medium text-bip-text">
                        
                        {row.keyword}
                      </td><td className="px-2 py-2 text-bip-text">
                        
                        {row.page_url ? (
                          <a
                            href={row.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[260px] truncate text-bip-text underline decoration-zinc-300 underline-offset-2 hover:text-bip-text"
                          >
                            
                            {row.page_url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td><td className="px-2 py-2 text-bip-text">
                        
                        {row.previous_position == null
                          ? "—"
                          : row.previous_position.toFixed(1)}
                      </td><td className="px-2 py-2 text-bip-text">
                        
                        {row.current_position == null
                          ? "—"
                          : row.current_position.toFixed(1)}
                      </td><td className="px-2 py-2">
                        
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${row.dropped_by_3_plus ? "border border-red-500/20 bg-red-500/10 text-red-400" : "bg-bip-fill text-bip-text"}`}
                        >
                          
                          {row.position_delta.toFixed(1)}
                        </span>
                      </td><td className="px-2 py-2 text-bip-text">
                        
                        {row.previous_clicks} {"->"} {row.current_clicks}
                      </td><td className="px-2 py-2">
                        
                        {row.dropped_by_3_plus ? (
                          <div className="space-y-1">
                            
                            <button
                              type="button"
                              onClick={() => onExplainKeywordDrop?.(row)}
                              disabled={loadingTheory || !onExplainKeywordDrop}
                              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-[11px] font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
                            >
                              
                              {loadingTheory ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : null}
                              Why did this drop?
                            </button>
                            {theory && (
                              <p className="text-[11px] text-bip-text">
                                
                                {theory.theory}
                                {""}
                                {theory.actionSignals.length > 0
                                  ? `Signals: ${theory.actionSignals.join(",")}.`
                                  : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-bip-muted">
                            Stable
                          </span>
                        )}
                      </td></tr>
                  );
                })}
              </tbody></table>
          </div>
        )}
      </section>
      <section className="rounded-lg border border-bip-border bg-bip-card p-3">
        
        <div className="mb-2 flex items-center justify-between gap-2">
          
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Gemini strategist summary
          </p>
          <button
            type="button"
            onClick={() => {
              setStrategistCopied(null);
              onGenerateStrategistSummary?.();
            }}
            disabled={strategistSummaryLoading || !onGenerateStrategistSummary}
            className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill disabled:opacity-60"
          >
            
            {strategistSummaryLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Generate summary
          </button>
        </div>
        <label className="block">
          
          <span className="text-xs text-bip-muted">Client goals</span>
          <textarea
            value={strategistSummaryGoals}
            onChange={(event) => {
              onChangeStrategistGoals?.(event.target.value);
              if (strategistCopied) setStrategistCopied(null);
            }}
            rows={2}
            className="mt-1 w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-xs text-bip-text focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            placeholder="Example: Increase new puppy appointments."
          />
        </label>
        {strategistSummaryError && (
          <p className="mt-2 text-sm text-red-600">{strategistSummaryError}</p>
        )}
        {!strategistSummary ? (
          <p className="mt-2 text-sm text-bip-text">
            
            Generate to produce The Win, The Concern, and The Next Move from
            Search Console and Facebook data.
          </p>
        ) : (
          <div className="mt-2 space-y-2 rounded-lg border border-bip-border p-3">
            
            <div className="flex justify-end">
              
              <button
                type="button"
                onClick={() => void handleCopyStrategistSummary()}
                className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill"
              >
                
                Copy for email
              </button>
            </div>
            <p className="text-sm text-bip-text">
              
              <span className="font-semibold">The Win:</span>
              {strategistSummary.theWin}
            </p>
            <p className="text-sm text-bip-text">
              
              <span className="font-semibold">The Concern:</span>
              {strategistSummary.theConcern}
            </p>
            <p className="text-sm text-bip-text">
              
              <span className="font-semibold">The Next Move:</span>
              {strategistSummary.theNextMove}
            </p>
            {strategistCopied && (
              <p className="text-xs text-bip-muted">{strategistCopied}</p>
            )}
          </div>
        )}
      </section>
      {/* Detailed Breakdown Charts */}
      <section className="rounded-lg border border-bip-border bg-bip-card p-3">
        
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-bip-muted">
          
          Detailed Breakdown (Charts)
        </p>
        {(() => {
          const perfRowsForCharts = buildWeeklyPerformanceRows({
            socialDailyRows: selectedSocialDailyRows,
            keywordRows: keywordHealthRows,
            adsSnapshot: selectedAdsSnapshot,
          });
          const { trendData, channelData, waterfallData } =
            buildDetailedBreakdownChartData({
              socialDailyRows: selectedSocialDailyRows,
              perfRows: perfRowsForCharts,
            });
          return (
            <div className="grid gap-4 md:grid-cols-2">
              
              {/* Line Chart - Trend */}
              <div>
                
                <p className="mb-1 text-xs font-medium text-bip-text">
                  Trend (Last 14 days)
                </p>
                <div className="h-52 w-full">
                  
                  <ResponsiveContainer>
                    
                    <LineChart
                      data={
                        trendData.length > 0
                          ? trendData
                          : [{ date: "No data", engagement: 0, reach: 0 }]
                      }
                    >
                      
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" /> <YAxis /> <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="engagement"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Engagement"
                      />
                      <Line
                        type="monotone"
                        dataKey="reach"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        name="Reach"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Bar Chart - Channel Comparison */}
              <div>
                
                <p className="mb-1 text-xs font-medium text-bip-text">
                  Channel Comparison (Current)
                </p>
                <div className="h-52 w-full">
                  
                  <ResponsiveContainer>
                    
                    <BarChart
                      data={
                        channelData.length > 0
                          ? channelData
                          : [{ name: "No data", value: 0 }]
                      }
                    >
                      
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" /> <YAxis /> <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#22c55e"
                        name="Current Value"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Waterfall-style Gains vs Dips */}
              <div className="md:col-span-2">
                
                <p className="mb-1 text-xs font-medium text-bip-text">
                  Gains vs Dips (Absolute Movement)
                </p>
                <div className="h-52 w-full">
                  
                  <ResponsiveContainer>
                    
                    <BarChart data={waterfallData}>
                      
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" /> <YAxis /> <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#8884d8"
                        name="Movement"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[11px] text-bip-muted">
                  
                  Positive bars = total gains across tracked metrics. Negative
                  bars = total dips.
                </p>
              </div>
            </div>
          );
        })()}
      </section>
      <MarketingUpdateComposer
        client={selectedClient}
        adsSnapshot={selectedAdsSnapshot}
      />
      <section className="rounded-lg border border-bip-border bg-bip-card p-3">
        
        <div className="mb-2 flex items-center justify-between gap-2">
          
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Weekly summary draft
          </p>
          <div className="flex items-center gap-2">
            
            <button
              type="button"
              onClick={() => {
                if (summaryTextareaRef.current) {
                  summaryTextareaRef.current.value = generatedSummary;
                }
                setSummaryCopied(null);
              }}
              className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill"
            >
              
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="rounded-md border border-bip-border px-2 py-1 text-xs font-medium text-bip-text hover:bg-bip-fill"
            >
              
              Copy
            </button>
          </div>
        </div>
        <textarea
          ref={summaryTextareaRef}
          defaultValue={generatedSummary}
          onChange={() => {
            if (summaryCopied) setSummaryCopied(null);
          }}
          rows={14}
          className="w-full bip-input shadow-none"
        />
        {summaryCopied && (
          <p className="mt-2 text-xs text-bip-muted">{summaryCopied}</p>
        )}
      </section>
      <section className="rounded-xl border border-bip-border bg-bip-card/50 p-4">
        
        <div className="mb-2 flex items-center justify-between gap-2">
          
          <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Issue rollup
          </p>
          <span className="text-xs text-bip-muted">
            {alerts.length} issues
          </span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-bip-accent">
            No cross-channel issues detected.
          </p>
        ) : (
          <ul className="space-y-2">
            
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-md border border-bip-border px-2.5 py-2"
              >
                
                <div className="flex flex-wrap items-center justify-between gap-2">
                  
                  <p className="text-sm font-medium text-bip-text">
                    {alert.title}
                  </p>
                  <SeverityChip severity={alert.severity} />
                </div>
                <p className="mt-1 text-xs text-bip-muted">
                  
                  {reportingSourceLabel(alert.source)} •{""}
                  {alert.detected_at
                    ? formatDateTime(alert.detected_at)
                    : "Unknown date"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
