import { notFound, redirect } from "next/navigation";
import ClientReportWorkspace from "@/components/reports/client-report-workspace";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import { createClient } from "@/lib/supabase/server";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import type {
  AdsSnapshot,
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
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "@/lib/reporting/report-config-types";

type Params = Promise<{ clientId: string }>;
type SearchParams = Promise<{ range?: string }>;

export default async function ReportClientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { clientId } = await params;
  const { range } = await searchParams;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await loadClientWorkspaceData(supabase, id);
  if (!workspace) notFound();
  const { client } = workspace;

  // ── Layout config ──────────────────────────────────────────────────────────
  const [{ data: clientConfigRaw }, { data: masterConfigRaw }] = await Promise.all([
    supabase
      .from("client_report_configs")
      .select("config")
      .eq("client_id", id)
      .maybeSingle(),
    supabase
      .from("report_template_config")
      .select("config")
      .eq("key", "master")
      .maybeSingle(),
  ]);
  const layoutConfig: ReportConfig =
    (clientConfigRaw?.config as ReportConfig | null) ??
    (masterConfigRaw?.config as ReportConfig | null) ??
    DEFAULT_REPORT_CONFIG;

  // ── Keywords ───────────────────────────────────────────────────────────────
  const { data: keywordsRaw } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const managedKeywordsRaw = (keywordsRaw ?? []) as ClientKeywordTarget[];
  const managedKeywords = managedKeywordsRaw.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    tag: row.tag,
    priority: row.priority,
    isActive: row.is_active,
  }));

  // ── Playbook ───────────────────────────────────────────────────────────────
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
    const verifications = item.auto_verify_key
      ? runVerifications([item.auto_verify_key], client)
      : [];
    const verifyResult = verifications[0] ?? null;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      tier_key: item.tier_key,
      type: item.type,
      status: verifyResult
        ? ((verifyResult.pass ? "pass" : "fail") as "pass" | "fail")
        : ("manual" as "manual"),
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
    gscSnapshotUpdatedAt:
      workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
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
  const staleSourceCount = freshness.filter(
    (item) => item.source !== "ga4" && item.status !== "fresh",
  ).length;
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

  // ── Keyword position history (cross-snapshot) ──────────────────────────────
  const { data: historicalQueryMetricsRaw } = await supabase
    .from("client_gsc_query_metrics")
    .select("query, clicks, impressions, position, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(2000);
  const queryRows = (historicalQueryMetricsRaw ?? []).map((row) => ({
    query: row.query as string,
    clicks: row.clicks as number,
    impressions: row.impressions as number,
    position: row.position as number,
    created_at: row.created_at as string,
  }));
  const keywordRows = managedKeywords
    .map((target) => {
      const matches = queryRows.filter(
        (row) => row.query.trim().toLowerCase() === target.keyword.trim().toLowerCase(),
      );
      const current = matches.slice(0, 7);
      const previous = matches.slice(7, 14);
      const currentClicks = current.reduce((sum, row) => sum + row.clicks, 0);
      const previousClicks = previous.reduce((sum, row) => sum + row.clicks, 0);
      const currentImpressions = current.reduce((sum, row) => sum + row.impressions, 0);
      const previousImpressions = previous.reduce((sum, row) => sum + row.impressions, 0);
      const currentPosition =
        current.length > 0
          ? current.reduce((sum, row) => sum + row.position, 0) / current.length
          : null;
      const previousPosition =
        previous.length > 0
          ? previous.reduce((sum, row) => sum + row.position, 0) / previous.length
          : null;
      const positionDelta =
        currentPosition == null || previousPosition == null
          ? 0
          : currentPosition - previousPosition;
      return {
        keyword: target.keyword,
        page_url: null,
        current_position: currentPosition,
        previous_position: previousPosition,
        position_delta: positionDelta,
        current_clicks: currentClicks,
        previous_clicks: previousClicks,
        current_impressions: currentImpressions,
        previous_impressions: previousImpressions,
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

  // ── Draft ──────────────────────────────────────────────────────────────────
  const { data: draftRow } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();
  const draft: ReportDraft | null = draftRow ?? null;

  // ── Sync timestamps ────────────────────────────────────────────────────────
  const syncTimestamps = {
    gsc: workspace.gscSnapshot?.updated_at ?? null,
    ads: workspace.adsSnapshot?.updated_at ?? null,
    social: workspace.socialDailySnapshots[0]?.created_at ?? null,
    gbp: workspace.gbpSnapshot?.updated_at ?? null,
  };

  return (
    <ClientReportWorkspace
      report={report}
      clientId={id}
      initialConfig={layoutConfig}
      initialDraft={draft}
      initialKeywords={managedKeywords}
      syncTimestamps={syncTimestamps}
    />
  );
}
