import type { createClient } from "@/lib/supabase/server";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import type {
  ClientKeywordTarget,
  GscPageMetric,
  KeywordHealthRow,
  StrategistSummaryResult,
} from "@/lib/types/client";
import type { PlaybookItem } from "@/lib/playbook/types";
import { runVerifications } from "@/lib/playbook/verify";
import {
  buildBaselineTechnicalFindings,
  buildClientReportModel,
  buildReportingActions,
  buildReportingAlerts,
  buildReportingFreshness,
  buildReportingKpis,
  computeClientUrgencyScore,
} from "@/lib/reporting/build-report";
import { DEFAULT_REPORT_CONFIG, mergeReportConfig, type ReportConfig } from "@/lib/reporting/report-config-types";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ManagedKeyword } from "@/lib/reporting/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type Workspace = NonNullable<Awaited<ReturnType<typeof loadClientWorkspaceData>>>;

export type LoadedReport = {
  report: ClientReportModel;
  config: ReportConfig;
  managedKeywords: ManagedKeyword[];
  workspace: Workspace;
};

// Assembles the full report model + layout config for a client. Shared by the
// report page and the Word export route so both render identical data.
export async function loadReportForClient(
  supabase: ServerClient,
  userId: string,
  clientId: number,
  range: string | undefined,
): Promise<LoadedReport | null> {
  const workspace = await loadClientWorkspaceData(supabase, clientId);
  if (!workspace) return null;
  const { client } = workspace;

  const [{ data: clientConfigRaw }, { data: masterConfigRaw }] = await Promise.all([
    supabase.from("client_report_configs").select("config").eq("client_id", clientId).maybeSingle(),
    supabase.from("report_template_config").select("config").eq("key", "master").maybeSingle(),
  ]);
  const config: ReportConfig = mergeReportConfig(
    (clientConfigRaw?.config as ReportConfig | null) ??
      (masterConfigRaw?.config as ReportConfig | null) ??
      DEFAULT_REPORT_CONFIG,
  );

  const { data: keywordsRaw } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  const managedKeywordsRaw = (keywordsRaw ?? []) as ClientKeywordTarget[];
  const managedKeywords: ManagedKeyword[] = managedKeywordsRaw.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    tag: row.tag,
    priority: row.priority,
    isActive: row.is_active,
  }));

  const activeTierKeys = [client.seo, client.ppc, client.smm, client.orm, client.blog].filter(
    (v): v is string => Boolean(v?.trim()),
  );
  const { data: playbookRaw } = activeTierKeys.length > 0
    ? await supabase
        .from("playbook_items")
        .select("id,title,category,tier_key,type,auto_verify_key,sort_order,is_active")
        .in("tier_key", activeTierKeys)
        .eq("is_active", true)
        .order("sort_order")
        .order("id")
    : { data: [] as PlaybookItem[] };
  const playbookItems = (playbookRaw ?? []) as PlaybookItem[];
  const playbookChecklist = playbookItems.map((item) => {
    const verifyResult = item.auto_verify_key ? runVerifications([item.auto_verify_key], client)[0] ?? null : null;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      tier_key: item.tier_key,
      type: item.type,
      status: verifyResult ? ((verifyResult.pass ? "pass" : "fail") as "pass" | "fail") : ("manual" as "manual"),
      verify_label: verifyResult?.label ?? null,
    };
  });

  const {
    adsSnapshot,
    adsSignals,
    gscPageMetrics,
    gscSignals,
    socialDailySnapshots: socialDailyRows,
    socialSignals,
    seoCrawlIssues: crawlIssues,
    seoCrawlSnapshot: crawlSnapshot,
    lighthouseSnapshot: lighthouse,
    sitemapSnapshot,
    gbpSnapshot,
    gbpReviews,
    threadEvents,
  } = workspace;

  const technicalFindings = buildBaselineTechnicalFindings(client);
  const freshness = buildReportingFreshness({
    adsUpdatedAt: adsSnapshot?.updated_at ?? null,
    gscUpdatedAt: workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
    socialUpdatedAt: socialDailyRows[0]?.created_at ?? null,
    lighthouseOrCrawlUpdatedAt: lighthouse?.fetched_at ?? crawlSnapshot?.updated_at ?? null,
    sitemapUpdatedAt: sitemapSnapshot?.updated_at ?? null,
    gbpUpdatedAt: gbpSnapshot?.updated_at ?? null,
    hasGa4Property: Boolean((client.ga4_property_id ?? "").trim()),
  });
  const alerts = buildReportingAlerts({ technicalFindings, gscSignals, adsSignals, socialSignals });
  const kpis = buildReportingKpis({
    adsSnapshot,
    ga4Snapshot: workspace.ga4Snapshot,
    gscPageMetrics,
    gscSignals,
    gscSnapshotUpdatedAt: workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
    socialDailyRows,
    socialPostCount: workspace.socialPostSnapshots.length,
    socialConnected: workspace.socialConnections.length > 0,
    crawlIssueCount: crawlIssues.length,
    technicalFindingCount: technicalFindings.length,
    technicalCriticalCount: technicalFindings.filter((f) => f.severity === "critical").length,
    sitemapSnapshot,
    gbpSnapshot,
    gbpReviews,
    lighthouseFetchedAt: lighthouse?.fetched_at ?? null,
    crawlUpdatedAt: crawlSnapshot?.updated_at ?? null,
  });
  const actions = buildReportingActions({ client, freshness, alerts });
  const staleSourceCount = freshness.filter((item) => item.source !== "ga4" && item.status !== "fresh").length;
  const urgencyScore = computeClientUrgencyScore({
    needsReply: client.needs_reply,
    staleDays: client.days_stale,
    hasCriticalTechnical: technicalFindings.some((f) => f.severity === "critical"),
    hasCriticalAds: adsSignals.some((s) => s.severity === "critical"),
    hasCriticalGsc: gscSignals.some((s) => s.severity === "critical"),
    missingScUrl: !(client.sc_url ?? "").trim(),
    missingAdsCustomerId: !(client.ads_customer_id ?? "").trim(),
    staleSourceCount,
  });

  const { data: historicalQueryMetricsRaw } = await supabase
    .from("client_gsc_query_metrics")
    .select("query, clicks, impressions, position, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(2000);
  const queryRows = (historicalQueryMetricsRaw ?? []).map((row) => ({
    query: row.query as string,
    clicks: row.clicks as number,
    impressions: row.impressions as number,
    position: row.position as number,
    created_at: row.created_at as string,
  }));
  const keywordRows: KeywordHealthRow[] = managedKeywords
    .map((target) => {
      const matches = queryRows.filter(
        (row) => row.query.trim().toLowerCase() === target.keyword.trim().toLowerCase(),
      );
      const current = matches.slice(0, 7);
      const previous = matches.slice(7, 14);
      const currentPosition = current.length > 0 ? current.reduce((s, r) => s + r.position, 0) / current.length : null;
      const previousPosition = previous.length > 0 ? previous.reduce((s, r) => s + r.position, 0) / previous.length : null;
      const positionDelta = currentPosition == null || previousPosition == null ? 0 : currentPosition - previousPosition;
      return {
        keyword: target.keyword,
        page_url: null,
        current_position: currentPosition,
        previous_position: previousPosition,
        position_delta: positionDelta,
        current_clicks: current.reduce((s, r) => s + r.clicks, 0),
        previous_clicks: previous.reduce((s, r) => s + r.clicks, 0),
        current_impressions: current.reduce((s, r) => s + r.impressions, 0),
        previous_impressions: previous.reduce((s, r) => s + r.impressions, 0),
        dropped_by_3_plus: positionDelta >= 3,
      } satisfies KeywordHealthRow;
    })
    .sort((a, b) => b.current_impressions - a.current_impressions);

  const report = buildClientReportModel({
    client,
    generatedAt: new Date().toISOString(),
    reportingWindowLabel: range === "last7" ? "Last 7 days" : "Last 30 days",
    urgencyScore,
    kpis,
    alerts,
    freshness,
    actions,
    keywordRows,
    socialDailyRows,
    socialPostSnapshots: workspace.socialPostSnapshots,
    adsSnapshot,
    ga4Snapshot: workspace.ga4Snapshot,
    gbpSnapshot,
    gbpReviews,
    gscPageMetrics: gscPageMetrics as GscPageMetric[],
    gscQueryMetrics: queryRows,
    managedKeywords,
    strategistSummary: null as StrategistSummaryResult | null,
    playbookChecklist,
    basecampEvents: threadEvents.map((e) => ({
      id: e.id,
      kind: e.kind,
      occurred_at: e.occurred_at,
      author_email: e.author_email,
      is_internal: e.is_internal,
      thread_title: e.thread_title,
      thread_excerpt: e.thread_excerpt,
      thread_url: e.thread_url,
    })),
  });

  return { report, config, managedKeywords, workspace };
}
