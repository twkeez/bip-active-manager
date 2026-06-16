"use client";
import { useMemo } from "react";
import { Map as MapIcon, Megaphone, Search, Share2 } from "lucide-react";
import AdsChannelPanel from "@/components/dashboard/ads-channel-panel";
import KpiSummaryGrid from "@/components/dashboard/kpi-summary-grid";
import AuditInspector from "@/components/site-audit/audit-inspector";
import { buildSmartAdsPlaybook } from "@/lib/ads/smart-playbook";
import {
  buildAdsKpiSummary,
  buildSeoKpiSummary,
} from "@/lib/dashboard/channel-kpi-summaries";
import type { InspectorIssue } from "@/lib/site-audit/inspector-issues";
import {
  buildClientSeoInspectorIssues,
  estimatePassedChecksFromScores,
} from "@/lib/site-audit/inspector-issues";
import type {
  AdsSignal,
  AdsSnapshot,
  ClientRow,
  GscPageMetric,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
  LighthouseAuditItem,
  LighthouseAuditOccurrence,
  LighthouseSnapshot,
  SeoCrawlIssue,
  SeoCrawlSnapshot,
  SitemapSnapshot,
  SitemapUrlRow,
  SocialConnection,
  SocialDailySnapshot,
  SocialIdea,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";
import {
  channelLabel,
  formatDateTime,
  type ChannelMetric,
  type FindingSeverity,
  type FindingStatus,
  type HelpdeskTicketSelection,
  type TechnicalChannel,
  type TechnicalFinding,
} from "./shared";
function SeverityChip({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}
    >
      
      {severity === "critical" ? "Critical" : "Watch"}
    </span>
  );
}
function StatusChip({ status }: { status: FindingStatus }) {
  const label =
    status === "in_progress"
      ? "In progress"
      : status === "open"
        ? "Open"
        : status === "acknowledged"
          ? "Acknowledged"
          : "Resolved";
  return (
    <span className="inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/75">
      
      {label}
    </span>
  );
}
function MetricTile({
  label,
  value,
  source,
  definition,
  updatedAt,
}: {
  label: string;
  value: string;
  source?: ChannelMetric["source"];
  definition?: string;
  updatedAt?: string | null;
}) {
  const sourceLabel =
    source === "internal"
      ? "Internal"
      : source === "lighthouse"
        ? "Lighthouse"
        : source === "crawl"
          ? "Crawl"
          : source === "gsc"
            ? "Search Console"
            : null;
  return (
    <div
      title={definition ? `${definition}` : undefined}
      className="rounded-md border border-white/[0.08] bg-bip-card px-2.5 py-2"
    >
      
      <p className="text-[11px] uppercase tracking-wide text-white/50">
        
        {label}
      </p>
      <p className="mt-1 font-medium text-white">{value}</p>
      {(sourceLabel || updatedAt) && (
        <p className="mt-1 text-[10px] text-white/50">
          
          {sourceLabel ?? ""} {sourceLabel && updatedAt ? " •" : ""}
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleString()}`
            : ""}
        </p>
      )}
    </div>
  );
}
export function FindingCard({ finding }: { finding: TechnicalFinding }) {
  return (
    <article className="rounded-lg border border-white/[0.08] bg-bip-card p-3">
      
      <div className="mb-1 flex items-center justify-between gap-2">
        
        <span className="inline-flex items-center gap-1 text-xs font-medium text-white/50">
          
          {finding.channel === "seo" && <Search className="h-3.5 w-3.5" />}
          {finding.channel === "ads" && <Megaphone className="h-3.5 w-3.5" />}
          {finding.channel === "sitemaps" && (
            <MapIcon className="h-3.5 w-3.5" />
          )}
          {finding.channel === "social" && <Share2 className="h-3.5 w-3.5" />}
          {channelLabel(finding.channel)}
        </span>
        <div className="flex items-center gap-1">
          
          <SeverityChip severity={finding.severity} />
          <StatusChip status={finding.status} />
        </div>
      </div>
      <p className="text-sm font-medium text-white"> {finding.title} </p>
      <p className="mt-1 text-xs text-white/50">
        
        Confidence {finding.confidence} • Impact {finding.impact} • Due
        {finding.dueLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        
        <button
          type="button"
          className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-bip-page"
        >
          
          Assign
        </button>
        <button
          type="button"
          className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-bip-page"
        >
          
          Mark done
        </button>
        <button
          type="button"
          className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-bip-page"
        >
          
          Snooze
        </button>
        <button
          type="button"
          className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-bip-page"
        >
          
          Ignore
        </button>
      </div>
    </article>
  );
}
export default function ChannelOverview({
  channel,
  findings,
  metrics,
  lighthouse,
  lighthouseLoading,
  lighthouseError,
  lighthouseStale,
  lighthouseAgeDays,
  crawlSnapshot,
  crawlIssues,
  crawlLoading,
  crawlError,
  gscSnapshot,
  gscSignals,
  gscPageMetrics,
  gscQueryMetrics,
  gscLoading,
  gscError,
  sitemapSnapshot,
  sitemapUrls,
  sitemapLoading,
  sitemapError,
  adsSnapshot,
  adsSignals,
  adsLoading,
  adsError,
  socialConnections,
  socialDaily,
  socialPosts,
  socialSignals,
  socialIdeas,
  socialLoading,
  socialError,
  socialIdeasLoading,
  socialIdeasError,
  noFixNeededSet,
  selectedSelectionKeys,
  selectedCount,
  selectedClient,
  noFixSavingKey,
  onRefreshLighthouse,
  onRunSeoCrawl,
  onSyncSearchConsole,
  onSyncSitemaps,
  onSyncAds,
  adsClientId,
  onSyncSocial,
  onGenerateSocialIdeas,
  onRefreshSocialToken,
  socialTokenRefreshing,
  socialTokenMessage,
  onToggleHelpdeskSelection,
  onToggleGenericHelpdeskSelection,
  onCopyHelpdeskTicket,
  onMarkNoFixNeeded,
}: {
  channel: TechnicalChannel;
  findings: TechnicalFinding[];
  metrics: ChannelMetric[];
  lighthouse: LighthouseSnapshot | null;
  lighthouseLoading: boolean;
  lighthouseError: string | null;
  lighthouseStale: boolean;
  lighthouseAgeDays: number | null;
  crawlSnapshot: SeoCrawlSnapshot | null;
  crawlIssues: SeoCrawlIssue[];
  crawlLoading: boolean;
  crawlError: string | null;
  gscSnapshot: GscSnapshot | null;
  gscSignals: GscSignal[];
  gscPageMetrics: GscPageMetric[];
  gscQueryMetrics: GscQueryMetric[];
  gscLoading: boolean;
  gscError: string | null;
  sitemapSnapshot: SitemapSnapshot | null;
  sitemapUrls: SitemapUrlRow[];
  sitemapLoading: boolean;
  sitemapError: string | null;
  adsSnapshot: AdsSnapshot | null;
  adsSignals: AdsSignal[];
  adsLoading: boolean;
  adsError: string | null;
  socialConnections: SocialConnection[];
  socialDaily: SocialDailySnapshot[];
  socialPosts: SocialPostSnapshot[];
  socialSignals: SocialSignal[];
  socialIdeas: SocialIdea[];
  socialLoading: boolean;
  socialError: string | null;
  socialIdeasLoading: boolean;
  socialIdeasError: string | null;
  noFixNeededSet: Set<string>;
  selectedSelectionKeys: Set<string>;
  selectedCount: number;
  selectedClient: ClientRow | null;
  noFixSavingKey: string | null;
  onRefreshLighthouse?: () => void;
  onRunSeoCrawl?: () => void;
  onSyncSearchConsole?: () => void;
  onSyncSitemaps?: () => void;
  onSyncAds?: () => void;
  adsClientId?: number | null;
  onSyncSocial?: () => void;
  onGenerateSocialIdeas?: () => void;
  onRefreshSocialToken?: () => void;
  socialTokenRefreshing?: boolean;
  socialTokenMessage?: string | null;
  onToggleHelpdeskSelection?: (
    item: LighthouseAuditItem,
    occurrence: LighthouseAuditOccurrence,
  ) => void;
  onToggleGenericHelpdeskSelection?: (
    selection: HelpdeskTicketSelection,
    occurrenceKey: string,
  ) => void;
  onCopyHelpdeskTicket?: () => void;
  onMarkNoFixNeeded?: (
    item: LighthouseAuditItem,
    occurrence: LighthouseAuditOccurrence,
  ) => void;
}) {
  const criticalCount = findings.filter(
    (finding) => finding.severity === "critical",
  ).length;
  const openIssuesLabel =
    channel === "seo" ? "Internal open issues" : "Open issues";
  const criticalLabel = channel === "seo" ? "Internal critical" : "Critical";
  const freshnessChips =
    channel === "seo"
      ? [
          lighthouse?.fetched_at
            ? `Lighthouse: ${formatDateTime(lighthouse.fetched_at)}`
            : "Lighthouse: not run",
          crawlSnapshot?.updated_at
            ? `Crawl: ${formatDateTime(crawlSnapshot.updated_at)}`
            : "Crawl: not run",
          gscSnapshot?.updated_at
            ? `Search Console: ${formatDateTime(gscSnapshot.updated_at)}`
            : "Search Console: not synced",
        ]
      : channel === "sitemaps"
        ? [
            sitemapSnapshot?.updated_at
              ? `Sitemap sync: ${formatDateTime(sitemapSnapshot.updated_at)}`
              : "Sitemap sync: not run",
            sitemapSnapshot?.latest_lastmod
              ? `Latest content update: ${formatDateTime(sitemapSnapshot.latest_lastmod)}`
              : "Latest content update: unavailable",
          ]
        : channel === "social"
          ? [
              socialDaily[0]?.created_at
                ? `Social daily: ${formatDateTime(socialDaily[0].created_at)}`
                : "Social daily: not synced",
              socialPosts[0]?.updated_at
                ? `Post snapshots: ${formatDateTime(socialPosts[0].updated_at)}`
                : "Post snapshots: not synced",
            ]
          : [];
  const weeklyRows = socialDaily.slice(0, 7);
  const weeklySummary = weeklyRows.reduce(
    (acc, row) => {
      acc.reach += row.reach ?? 0;
      acc.impressions += row.impressions ?? 0;
      acc.engagement += row.engagement ?? 0;
      acc.linkClicks += row.link_clicks ?? 0;
      return acc;
    },
    { reach: 0, impressions: 0, engagement: 0, linkClicks: 0 },
  );
  const weeklyEngagementRate =
    weeklySummary.impressions > 0
      ? `${((weeklySummary.engagement / weeklySummary.impressions) * 100).toFixed(2)}%`
      : "N/A";
  const channelKpiItems = useMemo(() => {
    if (channel === "seo") {
      return buildSeoKpiSummary({
        gscPageMetrics,
        gscSignals,
        crawlIssueCount: crawlIssues.length,
        lighthouse,
      });
    }
    if (channel === "ads") {
      return buildAdsKpiSummary({
        adsSnapshot,
        adsCriticalSignalCount: adsSignals.filter(
          (signal) => signal.severity === "critical",
        ).length,
        adsWatchSignalCount: adsSignals.filter(
          (signal) => signal.severity === "watch",
        ).length,
      });
    }
    return [];
  }, [
    channel,
    gscPageMetrics,
    gscSignals,
    crawlIssues.length,
    lighthouse,
    adsSnapshot,
    adsSignals,
  ]);
  const seoInspectorIssues = useMemo(() => {
    if (channel !== "seo") return [];
    const lighthouseItems = [
      ...(lighthouse?.seo_blockers ?? []),
      ...(lighthouse?.helpdesk_items ?? []),
    ];
    return buildClientSeoInspectorIssues({
      lighthouseItems,
      crawlIssues,
      gscSignals,
    });
  }, [channel, lighthouse, crawlIssues, gscSignals]);
  const adsPlaybookTasks = useMemo(() => {
    if (!adsSnapshot) return [];
    return buildSmartAdsPlaybook({
      keywordQuality: adsSnapshot.keyword_quality,
      searchBudgetLostImpressionShare:
        adsSnapshot.totals.search_budget_lost_impression_share,
      averageCpc: adsSnapshot.totals.average_cpc,
    });
  }, [adsSnapshot]);
  const seoPassedChecks = useMemo(() => {
    if (!lighthouse) return 0;
    return estimatePassedChecksFromScores({
      performance: lighthouse.scores.performance,
      seo: lighthouse.scores.seo,
      accessibility: null,
      bestPractices: null,
    });
  }, [lighthouse]);
  function handleInspectorToggle(issue: InspectorIssue) {
    if (!issue.occurrenceKey) return;
    if (
      issue.source === "Lighthouse" &&
      onToggleHelpdeskSelection &&
      lighthouse
    ) {
      const auditId = issue.id.replace(/^lh-/, "");
      const item = [
        ...lighthouse.seo_blockers,
        ...lighthouse.helpdesk_items,
      ].find((row) => row.id === auditId);
      if (!item) return;
      const occurrence = item.occurrences.find(
        (row) => row.occurrence_key === issue.occurrenceKey,
      ) ??
        item.occurrences[0] ?? {
          occurrence_key: issue.occurrenceKey,
          source_type: "unknown" as const,
          snippet: null,
          selector: null,
          explanation: null,
          location: null,
          offending_value: null,
        };
      onToggleHelpdeskSelection(item, occurrence);
      return;
    }
    if (issue.source === "Crawl" && onToggleGenericHelpdeskSelection) {
      const crawlIssue = crawlIssues.find(
        (row) => `crawl-${row.id}` === issue.id,
      );
      if (!crawlIssue) return;
      onToggleGenericHelpdeskSelection(
        {
          itemId: crawlIssue.rule_id,
          source: "crawl",
          title: crawlIssue.title,
          description: crawlIssue.description,
          suggestion: crawlIssue.suggestion,
          location: crawlIssue.location ?? crawlIssue.url,
          evidence: crawlIssue.evidence,
          severity: crawlIssue.severity,
        },
        crawlIssue.occurrence_key,
      );
      return;
    }
    if (issue.source === "Search Console" && onToggleGenericHelpdeskSelection) {
      const signal = gscSignals.find((row) => `gsc-${row.id}` === issue.id);
      if (!signal) return;
      onToggleGenericHelpdeskSelection(
        {
          itemId: signal.signal_id,
          source: "gsc",
          title: signal.title,
          description: signal.description,
          suggestion: signal.suggestion,
          location: signal.page_url ?? signal.query,
          evidence: signal.metric_value,
          severity: signal.severity,
        },
        signal.occurrence_key,
      );
    }
  }
  return (
    <div className="space-y-4">
      
      {channel === "seo" && <KpiSummaryGrid items={channelKpiItems} />}
      {channel !== "ads" && (
        <div className="grid grid-cols-3 gap-2">
          
          <div className="rounded-lg border border-white/[0.08] bg-bip-page p-2.5">
            
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              
              Channel
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              
              {channelLabel(channel)}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-page p-2.5">
            
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              
              {openIssuesLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              
              {findings.length}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-page p-2.5">
            
            <p className="text-[11px] uppercase tracking-wide text-white/50">
              
              {criticalLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              
              {criticalCount}
            </p>
          </div>
        </div>
      )}
      {metrics.length > 0 && channel !== "seo" && channel !== "ads" && (
        <div className="grid grid-cols-3 gap-2">
          
          {metrics.map((metric) => (
            <MetricTile
              key={metric.label}
              label={metric.label}
              value={metric.value}
              source={metric.source}
              definition={metric.definition}
              updatedAt={metric.updatedAt}
            />
          ))}
        </div>
      )}
      {(channel === "seo" ||
        channel === "sitemaps" ||
        channel === "social") && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3 text-xs text-white/75">
          
          <p className="font-semibold uppercase tracking-wide text-white/50">
            
            Data legend
          </p>
          <p className="mt-1">
            
            {channel === "seo"
              ? "Internal = app checks, Lighthouse = PageSpeed audit, Crawl = in-app crawler, Search Console = Google query/page data."
              : channel === "sitemaps"
                ? "Internal = app checks, Sitemap sync = parsed sitemap.xml data, Last updated = sitemap <lastmod> with HTTP Last-Modified fallback."
                : "Internal = app checks, Social sync = Meta Graph API snapshots (Facebook + Instagram)."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            
            {freshnessChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75"
              >
                
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}
      {channel === "seo" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Lighthouse (mobile)
            </p>
            <button
              type="button"
              onClick={onRefreshLighthouse}
              disabled={lighthouseLoading || !onRefreshLighthouse}
              className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
            >
              
              Refresh Lighthouse
            </button>
          </div>
          {lighthouse && (
            <p className="mt-2 text-[11px] text-white/50">
              
              Last run {formatDateTime(lighthouse.fetched_at)}
              {lighthouseAgeDays != null
                ? ` (${lighthouseAgeDays} days ago)`
                : ""}
            </p>
          )}
          {lighthouseStale && (
            <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
              
              Lighthouse data is 30+ days old. Recommended: rerun now.
            </p>
          )}
          {lighthouseLoading && (
            <p className="mt-2 text-sm text-white/75">
              
              Fetching Lighthouse data...
            </p>
          )}
          {lighthouseError && (
            <p className="mt-2 text-sm text-red-600">{lighthouseError}</p>
          )}
          {!lighthouseLoading && !lighthouseError && lighthouse && (
            <div className="mt-2 space-y-3">
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                
                <MetricTile
                  label="SEO score"
                  value={
                    lighthouse.scores.seo == null
                      ? "N/A"
                      : `${lighthouse.scores.seo}/100`
                  }
                  source="lighthouse"
                  definition="Latest Lighthouse SEO score from PageSpeed API."
                  updatedAt={lighthouse.fetched_at}
                />
                <MetricTile
                  label="Performance"
                  value={
                    lighthouse.scores.performance == null
                      ? "N/A"
                      : `${lighthouse.scores.performance}/100`
                  }
                  source="lighthouse"
                  definition="Latest Lighthouse Performance score from PageSpeed API."
                  updatedAt={lighthouse.fetched_at}
                />
                <MetricTile
                  label="LCP"
                  value={lighthouse.metrics.lcp ?? "N/A"}
                  source="lighthouse"
                  definition="Largest Contentful Paint from latest Lighthouse run."
                  updatedAt={lighthouse.fetched_at}
                />
                <MetricTile
                  label="CLS"
                  value={lighthouse.metrics.cls ?? "N/A"}
                  source="lighthouse"
                  definition="Cumulative Layout Shift from latest Lighthouse run."
                  updatedAt={lighthouse.fetched_at}
                />
                <MetricTile
                  label="FCP"
                  value={lighthouse.metrics.fcp ?? "N/A"}
                  source="lighthouse"
                  definition="First Contentful Paint from latest Lighthouse run."
                  updatedAt={lighthouse.fetched_at}
                />
                <MetricTile
                  label="TBT"
                  value={lighthouse.metrics.tbt ?? "N/A"}
                  source="lighthouse"
                  definition="Total Blocking Time from latest Lighthouse run."
                  updatedAt={lighthouse.fetched_at}
                />
              </div>
            </div>
          )}
          {!lighthouseLoading && !lighthouseError && !lighthouse && (
            <p className="mt-2 text-sm text-white/75">
              
              Lighthouse data will load when a website URL is available.
            </p>
          )}
        </div>
      )}
      {channel === "seo" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Website crawl (quick scan)
            </p>
            <button
              type="button"
              onClick={onRunSeoCrawl}
              disabled={crawlLoading || !onRunSeoCrawl}
              className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
            >
              
              Run Crawl
            </button>
          </div>
          {crawlSnapshot && (
            <p className="mt-2 text-[11px] text-white/50">
              
              Last run {formatDateTime(crawlSnapshot.updated_at)} •
              {crawlSnapshot.crawled_urls} URLs scanned
            </p>
          )}
          {crawlLoading && (
            <p className="mt-2 text-sm text-white/75">Running crawl...</p>
          )}
          {crawlError && (
            <p className="mt-2 text-sm text-red-600">{crawlError}</p>
          )}
          {!crawlLoading && crawlIssues.length > 0 && (
            <p className="mt-2 text-xs text-white/50">
              
              {crawlIssues.length} crawl issue
              {crawlIssues.length === 1 ? "" : "s"} in the unified
              checklist.
            </p>
          )}
        </div>
      )}
      {channel === "seo" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Search Console signals
            </p>
            <button
              type="button"
              onClick={onSyncSearchConsole}
              disabled={gscLoading || !onSyncSearchConsole}
              className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
            >
              
              Sync Search Console
            </button>
          </div>
          {gscSnapshot && (
            <p className="mt-2 text-[11px] text-white/50">
              
              Last sync {formatDateTime(gscSnapshot.updated_at)} •
              {gscSnapshot.start_date} to {gscSnapshot.end_date}
            </p>
          )}
          {!gscLoading && gscPageMetrics.length > 0 && (
            <p className="mt-2 text-[11px] text-white/50">
              
              Top page: {Math.round(gscPageMetrics[0]!.impressions)}
              impressions, CTR {(gscPageMetrics[0]!.ctr * 100).toFixed(2)}%
            </p>
          )}
          {!gscLoading && gscQueryMetrics.length > 0 && (
            <p className="mt-1 text-[11px] text-white/50">
              
              Top query: {gscQueryMetrics[0]!.query} (pos
              {gscQueryMetrics[0]!.position.toFixed(1)})
            </p>
          )}
          {gscLoading && (
            <p className="mt-2 text-sm text-white/75">
              
              Syncing Search Console...
            </p>
          )}
          {gscError && (
            <p className="mt-2 text-sm text-red-600">{gscError}</p>
          )}
          {!gscLoading && gscSignals.length > 0 && (
            <p className="mt-2 text-xs text-white/50">
              
              {gscSignals.length} Search Console signal
              {gscSignals.length === 1 ? "" : "s"} in the unified
              checklist.
            </p>
          )}
        </div>
      )}
      {channel === "seo" && seoInspectorIssues.length > 0 && (
        <div className="rounded-xl bg-bip-card p-6">
          
          <AuditInspector
            issues={seoInspectorIssues}
            passedChecks={seoPassedChecks}
            selectedKeys={selectedSelectionKeys}
            onToggleSelect={handleInspectorToggle}
          />
        </div>
      )}
      {channel === "seo" && selectedClient && (
        <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-bip-page px-3 py-2">
          
          <p className="text-xs text-white/75">
            
            {selectedCount} help desk item{selectedCount === 1 ? "" : "s"}
            selected
          </p>
          <button
            type="button"
            onClick={onCopyHelpdeskTicket}
            disabled={!onCopyHelpdeskTicket || selectedCount === 0}
            className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
          >
            
            Review/edit ticket text
          </button>
        </div>
      )}
      {channel === "sitemaps" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Sitemap freshness
            </p>
            <button
              type="button"
              onClick={onSyncSitemaps}
              disabled={sitemapLoading || !onSyncSitemaps}
              className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
            >
              
              Refresh sitemap
            </button>
          </div>
          {sitemapSnapshot && (
            <p className="mt-2 text-[11px] text-white/50">
              
              Last sync {formatDateTime(sitemapSnapshot.updated_at)} •
              {sitemapSnapshot.url_count} URLs •{""}
              {sitemapSnapshot.stale_90_count} stale (90+ days)
            </p>
          )}
          {sitemapLoading && (
            <p className="mt-2 text-sm text-white/75"> Syncing sitemap... </p>
          )}
          {sitemapError && (
            <p className="mt-2 text-sm text-red-600">{sitemapError}</p>
          )}
          {!sitemapLoading && sitemapUrls.length > 0 && (
            <div className="mt-2 overflow-auto rounded-md border border-white/[0.08]">
              
              <table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead><tr className="border-b border-white/[0.08] bg-white/[0.06]"><th className="px-2 py-1.5 font-medium text-white/75">
                      URL
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Lastmod
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      HTTP Last-Modified
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Effective updated
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Stale 90d
                    </th></tr></thead><tbody>{sitemapUrls.slice(0, 25).map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100"><td className="px-2 py-1.5 text-white/75">
                        
                        <a
                          href={row.loc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[300px] truncate underline decoration-zinc-300 underline-offset-2"
                        >
                          
                          {row.loc}
                        </a>
                      </td><td className="px-2 py-1.5 text-white/75">
                        
                        {row.lastmod ? formatDateTime(row.lastmod) : "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        
                        {row.http_last_modified
                          ? formatDateTime(row.http_last_modified)
                          : "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        
                        {row.effective_updated_at
                          ? formatDateTime(row.effective_updated_at)
                          : "—"}
                      </td><td className="px-2 py-1.5">
                        
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${row.is_stale_90 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          
                          {row.is_stale_90 ? "Yes" : "No"}
                        </span>
                      </td></tr>
                  ))}
                </tbody></table>
            </div>
          )}
        </div>
      )}
      {channel === "social" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Social reporting (Facebook + Instagram)
            </p>
            <div className="flex items-center gap-1.5">
              
              <button
                type="button"
                onClick={onRefreshSocialToken}
                disabled={socialTokenRefreshing || !onRefreshSocialToken}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
              >
                
                Refresh token
              </button>
              <button
                type="button"
                onClick={onSyncSocial}
                disabled={socialLoading || !onSyncSocial}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
              >
                
                Sync social
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-white/50">
            
            {socialConnections.length} platform connection
            {socialConnections.length === 1 ? "" : "s"} • {socialPosts.length}
            posts/media tracked
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            
            {socialSignals.length} evaluation signal
            {socialSignals.length === 1 ? "" : "s"}
          </p>
          {socialLoading && (
            <p className="mt-2 text-sm text-white/75">Syncing social data...</p>
          )}
          {socialError && (
            <p className="mt-2 text-sm text-red-600">{socialError}</p>
          )}
          {socialTokenMessage && (
            <p className="mt-2 text-xs text-white/75">{socialTokenMessage}</p>
          )}
          {!socialLoading && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              
              <MetricTile
                label="7d Reach"
                value={String(weeklySummary.reach)}
                source="internal"
              />
              <MetricTile
                label="7d Impressions"
                value={String(weeklySummary.impressions)}
                source="internal"
              />
              <MetricTile
                label="7d Engagement"
                value={String(weeklySummary.engagement)}
                source="internal"
              />
              <MetricTile
                label="Engagement rate"
                value={weeklyEngagementRate}
                source="internal"
              />
            </div>
          )}
          {!socialLoading && socialPosts.length > 0 && (
            <div className="mt-3 overflow-auto rounded-md border border-white/[0.08]">
              
              <table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr className="border-b border-white/[0.08] bg-white/[0.06]"><th className="px-2 py-1.5 font-medium text-white/75">
                      Platform
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Type
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Published
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Reach
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Impressions
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Engagement
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Comments
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Shares
                    </th><th className="px-2 py-1.5 font-medium text-white/75">
                      Clicks
                    </th></tr></thead><tbody>{socialPosts.slice(0, 25).map((post) => (
                    <tr
                      key={`${post.platform}-${post.post_id}`}
                      className="border-b border-zinc-100"
                    ><td className="px-2 py-1.5 text-white/75">
                        {post.platform}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.media_type ?? "post"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.published_at
                          ? formatDateTime(post.published_at)
                          : "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.reach ?? "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.impressions ?? "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.engagement ?? "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.comments ?? "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.shares ?? "—"}
                      </td><td className="px-2 py-1.5 text-white/75">
                        {post.link_clicks ?? "—"}
                      </td></tr>
                  ))}
                </tbody></table>
            </div>
          )}
        </div>
      )}
      {channel === "social" && (
        <div className="rounded-lg border border-white/[0.08] bg-bip-page p-3">
          
          <div className="flex items-center justify-between gap-2">
            
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              
              Social idea queue
            </p>
            <button
              type="button"
              onClick={onGenerateSocialIdeas}
              disabled={socialIdeasLoading || !onGenerateSocialIdeas}
              className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
            >
              
              Generate ideas
            </button>
          </div>
          {socialIdeasError && (
            <p className="mt-2 text-sm text-red-600">{socialIdeasError}</p>
          )}
          {socialIdeas.length === 0 ? (
            <p className="mt-2 text-sm text-white/75">
              
              Generate idea cards from recent top-performing posts and weak
              themes.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              
              {socialIdeas.map((idea) => (
                <li
                  key={idea.id}
                  className="rounded-md border border-white/[0.08] bg-bip-card p-2 text-xs"
                >
                  
                  <p className="font-medium text-white">{idea.theme}</p>
                  <p className="mt-1 text-white/75">
                    Objective: {idea.objective}
                  </p>
                  <p className="mt-1 text-white/75">Hook: {idea.hook}</p>
                  <p className="mt-1 text-white/75">Format: {idea.format}</p>
                  <p className="mt-1 text-white/75">CTA: {idea.cta}</p>
                  <p className="mt-1 text-white/50">
                    Suggested window: {idea.suggested_window}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {channel === "ads" && (
        <AdsChannelPanel
          adsSnapshot={adsSnapshot}
          adsLoading={adsLoading}
          adsError={adsError}
          adsClientId={adsClientId ?? null}
          playbookTaskCount={adsPlaybookTasks.length}
          kpiItems={channelKpiItems}
          clientName={selectedClient?.account_name}
          onSyncAds={onSyncAds}
        />
      )}
      {channel === "ads" ? null : channel !== "seo" ||
        seoInspectorIssues.length === 0 ? (
        findings.length === 0 ? (
          <p className="rounded-lg border border-white/[0.08] bg-bip-page px-3 py-2 text-sm text-white/75">
            
            No findings yet. Connect this channel to populate diagnostics.
          </p>
        ) : (
          <ul className="space-y-2">
            
            {findings.map((finding) => (
              <li key={finding.id}>
                
                <FindingCard finding={finding} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
