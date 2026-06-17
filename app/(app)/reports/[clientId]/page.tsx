import { notFound, redirect } from "next/navigation";
import ClientReportPage from "@/components/reports/client-report-page";
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
import {
  buildBaselineTechnicalFindings,
  buildClientReportModel,
  buildReportingActions,
  buildReportingAlerts,
  buildReportingFreshness,
  buildReportingKpis,
  computeClientUrgencyScore,
} from "@/lib/reporting/build-report";
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
  const {
    adsSnapshot,
    adsSignals,
    gscPageMetrics,
    gscSignals,
    gscQueryMetrics,
    socialDailySnapshots: socialDailyRows,
    socialSignals,
    seoCrawlIssues: crawlIssues,
    seoCrawlSnapshot: crawlSnapshot,
    lighthouseSnapshot: lighthouse,
    sitemapSnapshot,
    gbpSnapshot,
    gbpReviews,
  } = workspace;
  const technicalFindings = buildBaselineTechnicalFindings(client);
  const freshness = buildReportingFreshness({
    adsUpdatedAt: adsSnapshot?.updated_at ?? null,
    gscUpdatedAt:
      workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
    socialUpdatedAt: socialDailyRows[0]?.created_at ?? null,
    lighthouseOrCrawlUpdatedAt:
      lighthouse?.fetched_at ?? crawlSnapshot?.updated_at ?? null,
    sitemapUpdatedAt: sitemapSnapshot?.updated_at ?? null,
    gbpUpdatedAt: gbpSnapshot?.updated_at ?? null,
    hasGa4Property: Boolean((client.ga4_property_id ?? "").trim()),
  });
  const alerts = buildReportingAlerts({
    technicalFindings,
    gscSignals,
    adsSignals,
    socialSignals,
  });
  const kpis = buildReportingKpis({
    adsSnapshot,
    gscPageMetrics,
    gscSignals,
    gscSnapshotUpdatedAt:
      workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
    socialDailyRows,
    socialPostCount: workspace.socialPostSnapshots.length,
    socialConnected: workspace.socialConnections.length > 0,
    crawlIssueCount: crawlIssues.length,
    technicalFindingCount: technicalFindings.length,
    technicalCriticalCount: technicalFindings.filter(
      (finding) => finding.severity === "critical",
    ).length,
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
    hasCriticalTechnical: technicalFindings.some(
      (finding) => finding.severity === "critical",
    ),
    hasCriticalAds: adsSignals.some((signal) => signal.severity === "critical"),
    hasCriticalGsc: gscSignals.some((signal) => signal.severity === "critical"),
    missingScUrl: !(client.sc_url ?? "").trim(),
    missingAdsCustomerId: !(client.ads_customer_id ?? "").trim(),
    staleSourceCount,
  });
  const queryRows = gscQueryMetrics.map((row) => ({
    query: row.query,
    clicks: row.clicks,
    impressions: row.impressions,
    position: row.position,
    created_at: row.created_at,
  }));
  const keywordRows = managedKeywords
    .map((target) => {
      const matches = queryRows.filter(
        (row) =>
          row.query.trim().toLowerCase() ===
          target.keyword.trim().toLowerCase(),
      );
      const current = matches.slice(0, 7);
      const previous = matches.slice(7, 14);
      const currentClicks = current.reduce((sum, row) => sum + row.clicks, 0);
      const previousClicks = previous.reduce((sum, row) => sum + row.clicks, 0);
      const currentImpressions = current.reduce(
        (sum, row) => sum + row.impressions,
        0,
      );
      const previousImpressions = previous.reduce(
        (sum, row) => sum + row.impressions,
        0,
      );
      const currentPosition =
        current.length > 0
          ? current.reduce((sum, row) => sum + row.position, 0) / current.length
          : null;
      const previousPosition =
        previous.length > 0
          ? previous.reduce((sum, row) => sum + row.position, 0) /
            previous.length
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
    adsSnapshot,
    gscPageMetrics: gscPageMetrics as GscPageMetric[],
    gscQueryMetrics: queryRows,
    managedKeywords,
    strategistSummary: null as StrategistSummaryResult | null,
  });
  // Load draft to apply overrides
  const { data: draftRow } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();
  const draft: ReportDraft | null = draftRow ?? null;

  return <ClientReportPage report={report} draft={draft} />;
}
