import { pickKeywordPeriods, pickPreviousWindow, type GscSnapshotWindow, type KeywordPeriodRow } from "@/lib/reporting/keyword-periods";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { noteReadProblems } from "@/lib/data-integrity/server";
import { sumSearchRows, type SearchTotals } from "@/lib/reporting/search-totals";
import type { createClient } from "@/lib/supabase/server";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
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
import { loadPlaybookChecklist } from "@/lib/reporting/playbook-checklist";
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
  /** What could not be read in full; the exports refuse while any is listed. */
  readProblems: string[];
};

/**
 * Search Console syncs before Nov 2026 stored only the top 100 queries. A
 * snapshot with exactly that many may be one of them, so a managed keyword
 * missing from it is unknown, not 0.
 */
export const LEGACY_GSC_QUERY_CAP = 100;

// Assembles the full report model + layout config for a client. Shared by the
// report page and the Word export route so both render identical data.
//
// Every read here either succeeds or is named: a failed read, or a list read
// only in part, is passed to noteReadProblems, so the page shows it and the
// print and Word exports refuse (lib/data-integrity/server.ts). Until Nov 2026
// most errors here were ignored and the section showed 0 or nothing.
export async function loadReportForClient(
  supabase: ServerClient,
  userId: string,
  clientId: number,
  // Still accepted from the page and Word routes (?range=), but every channel is
  // synced for about 30 days, so it no longer changes the report.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _range: string | undefined,
): Promise<LoadedReport | null> {
  // Numbers come from the last sync that finished, never a running or failed one.
  const workspace = await loadClientWorkspaceData(supabase, clientId, { completedOnly: true });
  if (!workspace) return null;
  const { client } = workspace;
  const problems: string[] = [...workspace.readProblems];
  const note = (label: string, error: { message: string } | null | undefined) => {
    if (error) problems.push(`${label} could not be read: ${error.message}`);
  };

  const [{ data: clientConfigRaw, error: clientConfigError }, { data: masterConfigRaw, error: masterConfigError }] =
    await Promise.all([
      supabase.from("client_report_configs").select("config").eq("client_id", clientId).maybeSingle(),
      supabase.from("report_template_config").select("config").eq("key", "master").maybeSingle(),
    ]);
  note("This client's report layout", clientConfigError);
  note("The master report layout", masterConfigError);
  const config: ReportConfig = mergeReportConfig(
    (clientConfigRaw?.config as ReportConfig | null) ??
      (masterConfigRaw?.config as ReportConfig | null) ??
      DEFAULT_REPORT_CONFIG,
  );

  const { data: keywordsRaw, error: keywordsError } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  note("Tracked keywords", keywordsError);
  const managedKeywordsRaw = (keywordsRaw ?? []) as ClientKeywordTarget[];
  const managedKeywords: ManagedKeyword[] = managedKeywordsRaw.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    tag: row.tag,
    priority: row.priority,
    isActive: row.is_active,
  }));

  const playbookChecklist = await loadPlaybookChecklist(supabase, client);

  const {
    adsSnapshot,
    adsSignals,
    metaAdsSnapshot,
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

  const { data: periodReachRaw, error: periodReachError } = await supabase
    .from("client_social_period_metrics")
    .select("platform, reach")
    .eq("client_id", clientId);
  note("Social reach", periodReachError);
  const socialPeriodReach = (periodReachRaw ?? [])
    .filter((r) => typeof r.reach === "number")
    .map((r) => ({ platform: r.platform as string, reach: r.reach as number }));

  // Organic (blue-link) rank per keyword at the practice baseline (the report
  // shows one location; multi-location detail lives in the cockpit). Latest two
  // snapshots → current + movement.
  // Read in full: this stopped at 1000 rows across every location and scan,
  // which dropped the previous scan (and its movement) for bigger clients.
  type OrganicRow = { keyword: string; position: number | null; url: string | null; top_domain: string | null; location_label: string | null };
  let organicSnaps: OrganicRow[] = [];
  try {
    organicSnaps = await fetchAllRows<OrganicRow>(
      (from, to) =>
        supabase
          .from("client_organic_rank_snapshots")
          .select("id, keyword, position, url, top_domain, location_label, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "Organic rankings",
    );
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Organic rankings could not be read");
  }
  const organicByKw = new Map<string, Array<{ position: number | null; url: string | null; top_domain: string | null }>>();
  for (const row of organicSnaps) {
    // Only the practice baseline (null on rows predating locations, or "Practice").
    if (row.location_label != null && row.location_label !== "Practice") continue;
    const arr = organicByKw.get(row.keyword) ?? [];
    if (arr.length < 2) {
      arr.push(row);
      organicByKw.set(row.keyword, arr);
    }
  }
  const organicRanks = [...organicByKw.entries()].map(([keyword, r]) => {
    const cur = r[0];
    const prev = r[1] ?? null;
    const delta = cur.position != null && prev?.position != null ? prev.position - cur.position : null;
    return { keyword, position: cur.position, url: cur.url, topDomain: cur.top_domain, delta };
  });

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
  const { count: socialPostCount30d, error: socialPostCountError } = await supabase
    .from("client_social_post_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("published_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  note("The count of social posts", socialPostCountError);

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

  // Keyword numbers: the newest completed 28-day snapshot against the one
  // covering the 28 days before it. Never a sum of snapshots (see
  // lib/reporting/keyword-periods.ts). Both lists are read in full.
  const snapshotWindows = await fetchAllRows<GscSnapshotWindow>(
    (from, to) =>
      supabase
        .from("client_gsc_snapshots")
        .select("id, start_date, end_date, run_status, created_at")
        .eq("client_id", clientId)
        .order("end_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    "Search Console sync history",
  ).catch((error: Error) => {
    problems.push(error.message);
    return [] as GscSnapshotWindow[];
  });
  const periods = pickKeywordPeriods(snapshotWindows);
  const periodIds = [periods.current?.id, periods.previous?.id].filter((id): id is number => id != null);
  type QueryMetricRow = { snapshot_id: number; query: string; clicks: number; impressions: number; position: number };
  const periodMetricsRaw = periodIds.length
    ? await fetchAllRows<QueryMetricRow>(
        (from, to) =>
          supabase
            .from("client_gsc_query_metrics")
            .select("id, snapshot_id, query, clicks, impressions, position")
            .in("snapshot_id", periodIds)
            .order("id", { ascending: true })
            .range(from, to),
        "Search Console keywords",
      ).catch((error: Error) => {
        problems.push(error.message);
        return [] as QueryMetricRow[];
      })
    : [];
  const queryRows: KeywordPeriodRow[] = periodMetricsRaw.map((row) => ({
    query: row.query,
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    position: Number(row.position) || 0,
    period: Number(row.snapshot_id) === periods.current?.id ? "current" : "previous",
  }));
  // A snapshot from before full query lists were stored (exactly 100 rows):
  // a keyword missing from it may simply have been below the top 100.
  const legacyCapped = (period: "current" | "previous") =>
    queryRows.filter((row) => row.period === period).length === LEGACY_GSC_QUERY_CAP;
  const currentCapped = legacyCapped("current");
  const previousCapped = legacyCapped("previous");
  const previousAvailable = periods.previous != null;
  const cutOffKeywords: string[] = [];
  const keywordRows: KeywordHealthRow[] = managedKeywords
    .map((target) => {
      const key = target.keyword.trim().toLowerCase();
      const current = queryRows.find((row) => row.period === "current" && row.query.trim().toLowerCase() === key);
      const previous = queryRows.find((row) => row.period === "previous" && row.query.trim().toLowerCase() === key);
      const positionDelta = current && previous ? current.position - previous.position : 0;
      if (!current && currentCapped) cutOffKeywords.push(target.keyword);
      return {
        keyword: target.keyword,
        page_url: null,
        current_position: current?.position ?? null,
        previous_position: previous?.position ?? null,
        position_delta: positionDelta,
        current_clicks: current?.clicks ?? 0,
        previous_clicks: previous?.clicks ?? 0,
        current_impressions: current?.impressions ?? 0,
        previous_impressions: previous?.impressions ?? 0,
        dropped_by_3_plus: positionDelta >= 3,
        // Unknown, not 0, when the earlier sync may have cut this keyword off;
        // the report then shows no comparison rather than a false drop.
        previous_available: previousAvailable && (previous != null || !previousCapped),
      } satisfies KeywordHealthRow;
    })
    .sort((a, b) => b.current_impressions - a.current_impressions);
  if (cutOffKeywords.length) {
    problems.push(
      `${cutOffKeywords.length} tracked keyword${cutOffKeywords.length === 1 ? " is" : "s are"} not among the top ${LEGACY_GSC_QUERY_CAP} searches in the latest Search Console sync, which was stored before full keyword lists were kept (${cutOffKeywords.slice(0, 5).map((k) => `"${k}"`).join(", ")}${cutOffKeywords.length > 5 ? ", …" : ""}). Sync Search Console again to get their real numbers.`,
    );
  }

  // Search numbers for the report all come from the same period as the
  // keywords: the newest completed snapshot, and the one before it. Whole-site
  // totals are the site's day-by-day numbers (what Google's Performance report
  // shows), not the listed pages added up; pages are read in full, not capped.
  const pageRowsFor = (snapshotId: number) =>
    fetchAllRows<GscPageMetric>(
      (from, to) =>
        supabase
          .from("client_gsc_page_metrics")
          .select("*")
          .eq("snapshot_id", snapshotId)
          .order("id", { ascending: true })
          .range(from, to),
      "Search Console page metrics",
    );
  const failedRead = <T,>(fallback: T) => (error: Error) => {
    problems.push(error.message);
    return fallback;
  };
  // With no completed snapshot there are no Search numbers to show; the
  // workspace's page list (capped at 250 for its own screens) is not used.
  const [currentPages, previousPages, dailyRaw] = await Promise.all([
    periods.current ? pageRowsFor(periods.current.id).catch(failedRead([] as GscPageMetric[])) : Promise.resolve([] as GscPageMetric[]),
    periods.previous ? pageRowsFor(periods.previous.id).catch(failedRead([] as GscPageMetric[])) : Promise.resolve([] as GscPageMetric[]),
    periodIds.length
      ? fetchAllRows<{ snapshot_id: number; metric_date: string; clicks: number; impressions: number; position: number }>(
          (from, to) =>
            supabase
              .from("client_gsc_daily_metrics")
              .select("id, snapshot_id, metric_date, clicks, impressions, position")
              .in("snapshot_id", periodIds)
              .order("id", { ascending: true })
              .range(from, to),
          "Search Console daily metrics",
        ).catch(failedRead([] as Array<{ snapshot_id: number; metric_date: string; clicks: number; impressions: number; position: number }>))
      : Promise.resolve([]),
  ]);
  const dailyTotalsFor = (snapshotId: number | undefined): SearchTotals | null => {
    if (snapshotId == null) return null;
    // Numeric columns can arrive as strings, so read every value as a number.
    const rows = dailyRaw
      .filter((row) => Number(row.snapshot_id) === snapshotId)
      .map((row) => ({
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        position: Number(row.position) || 0,
      }));
    return rows.length > 0 ? sumSearchRows(rows) : null;
  };
  const currentDaily = dailyTotalsFor(periods.current?.id);
  // The dates the numbers really cover. Search Console only returns finished
  // days, so a sync run just after midnight has no row for its last day yet
  // (Adobe Animal Hospital, Nov 24 2026: labelled "to Nov 23", data to Nov 22,
  // matching Search Console's own total for Oct 27 to Nov 22).
  const currentDays = periods.current
    ? dailyRaw
        .filter((row) => Number(row.snapshot_id) === periods.current!.id)
        .map((row) => String(row.metric_date).slice(0, 10))
        .sort()
    : [];
  const gscSiteTotals =
    currentDaily && periods.current
      ? {
          current: {
            ...currentDaily,
            startDate: currentDays[0] ?? periods.current.start_date,
            endDate: currentDays[currentDays.length - 1] ?? periods.current.end_date,
            source: "daily" as const,
          },
          // Compare like with like: only the previous period's own daily totals.
          previous: dailyTotalsFor(periods.previous?.id),
        }
      : undefined;

  // Google Ads: compare the snapshot shown with the one covering the 30 days
  // before it, when that was captured.
  let previousAdsSnapshot: AdsSnapshot | null = null;
  if (adsSnapshot?.start_date) {
    // Dates first (each full snapshot carries large campaign and call lists),
    // then the one full row that matches.
    // Only snapshots ending within a week of this one's start can match.
    const earliestEnd = new Date(Date.parse(`${adsSnapshot.start_date.slice(0, 10)}T00:00:00Z`) - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const adsWindows = await fetchAllRows<GscSnapshotWindow>(
      (from, to) =>
        supabase
          .from("client_ads_snapshots")
          .select("id, start_date, end_date, run_status, created_at")
          .eq("client_id", clientId)
          .eq("run_status", "completed")
          .lt("end_date", adsSnapshot.start_date)
          .gte("end_date", earliestEnd)
          .order("end_date", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "Earlier Google Ads syncs",
    ).catch(failedRead([] as GscSnapshotWindow[]));
    const match = pickPreviousWindow(adsSnapshot, adsWindows);
    if (match) {
      const { data: full, error: fullError } = await supabase
        .from("client_ads_snapshots")
        .select("*")
        .eq("id", match.id)
        .maybeSingle<AdsSnapshot>();
      note("The previous Google Ads period", fullError);
      previousAdsSnapshot = full ?? null;
    }
  }

  const kpis = buildReportingKpis({
    adsSnapshot,
    metaAdsSnapshot,
    ga4Snapshot: workspace.ga4Snapshot,
    // Every page of the report's Search period, not the workspace's top 250.
    gscPageMetrics: currentPages,
    gscSignals,
    gscSnapshotUpdatedAt: workspace.gscSnapshot?.updated_at ?? gscSignals[0]?.created_at ?? null,
    socialDailyRows,
    socialPeriodReach,
    // Posts published in the last 30 days, counted by the database. This was
    // the number of posts loaded (all time, capped at 500) under a "(30d)"
    // label (found 2026-09-28).
    socialPostCount: socialPostCount30d ?? 0,
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
  const report = buildClientReportModel({
    client,
    generatedAt: new Date().toISOString(),
    // Every channel's numbers cover about 30 days whatever is asked for, so the
    // report says so. "last7" used to relabel the same 30-day numbers as 7 days.
    reportingWindowLabel: "Last 30 days",
    urgencyScore,
    kpis,
    alerts,
    freshness,
    actions,
    keywordRows,
    socialDailyRows,
    socialPeriodReach,
    organicRanks,
    socialPostSnapshots: workspace.socialPostSnapshots,
    adsSnapshot,
    metaAdsSnapshot,
    ga4Snapshot: workspace.ga4Snapshot,
    gbpSnapshot,
    gbpReviews,
    previousAdsSnapshot,
    gscPageMetrics: currentPages,
    gscPreviousPageMetrics: previousPages,
    gscSiteTotals,
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

  noteReadProblems("Client report", problems);
  return { report, config, managedKeywords, workspace, readProblems: problems };
}
