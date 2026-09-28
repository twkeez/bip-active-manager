import type {
  AdsSignal,
  AdsSnapshot,
  ClientRow,
  GbpReviewRow,
  GbpSnapshot,
  GscPageMetric,
  GscSignal,
  ReportingAlertItem,
  ReportingFreshnessItem,
  SitemapSnapshot,
  SocialDailySnapshot,
  SocialSignal,
} from "@/lib/types/client";
import {
  buildReportingAlerts,
  buildReportingFreshness,
  buildReportingKpis,
  computeClientUrgencyScore,
  buildBaselineTechnicalFindings,
} from "@/lib/reporting/build-report";
import { getBigQueryDatasetRef, runBigQueryQuery } from "@/lib/reporting/bigquery";
import { ensureReportingModelV1 } from "@/lib/reporting/bigquery-models";
import { fetchLatestSnapshotsByClient } from "@/lib/dashboard/snapshot-queries";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { pickKeywordPeriods, type GscSnapshotWindow, type KeywordPeriodRow } from "@/lib/reporting/keyword-periods";
import type { SupabaseClient } from "@supabase/supabase-js";

type SyncOutcome = {
  syncedClients: number;
  metricRows: number;
  channelRows: number;
  alertRows: number;
  keywordRows: number;
  startedAt: string;
  finishedAt: string;
};

type ClientContext = {
  client: ClientRow;
  adsSnapshot: AdsSnapshot | null;
  adsSignals: AdsSignal[];
  gscPageMetrics: GscPageMetric[];
  gscSignals: GscSignal[];
  socialDailyRows: SocialDailySnapshot[];
  socialSignals: SocialSignal[];
  sitemapSnapshot: SitemapSnapshot | null;
  gbpSnapshot: GbpSnapshot | null;
  gbpReviews: GbpReviewRow[];
  keywordRows: Array<{
    keyword: string;
    current_position: number | null;
    previous_position: number | null;
    position_delta: number;
    current_clicks: number;
    previous_clicks: number;
    dropped_by_3_plus: boolean;
  }>;
  crawlIssueCount: number;
  technicalCriticalCount: number;
  staleSourceCount: number;
  urgencyScore: number;
  freshness: ReportingFreshnessItem[];
  alerts: ReportingAlertItem[];
};

function toNumberOrNull(value: string) {
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentValue(value: string) {
  const parsed = Number(String(value).replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function groupRowsByClientId<T extends { client_id: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const bucket = map.get(row.client_id);
    if (bucket) bucket.push(row);
    else map.set(row.client_id, [row]);
  }
  return map;
}

function rowsForClient<T>(map: Map<number, T[]>, clientId: number, limit: number): T[] {
  return (map.get(clientId) ?? []).slice(0, limit);
}

/**
 * Keyword facts from one 28-day period against the 28 days before it (see
 * lib/reporting/keyword-periods.ts). This used to sum the newest 200 query
 * rows across many overlapping nightly snapshots as "current" and the next
 * 200 as "previous", inflating clicks several times over (found 2026-09-28).
 */
function buildKeywordRowsFromQueryMetrics(queryRows: KeywordPeriodRow[]) {
  const byKey = new Map<string, { current?: KeywordPeriodRow; previous?: KeywordPeriodRow }>();
  for (const row of queryRows) {
    const key = row.query.trim().toLowerCase();
    if (!key) continue;
    const entry = byKey.get(key) ?? {};
    entry[row.period] = row;
    byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .filter(([, entry]) => entry.current)
    .map(([keyword, { current, previous }]) => {
      const currentPosition = current!.position;
      const previousPosition = previous ? previous.position : null;
      const positionDelta = previousPosition == null ? 0 : currentPosition - previousPosition;
      return {
        keyword,
        current_position: currentPosition,
        previous_position: previousPosition,
        position_delta: positionDelta,
        current_clicks: current!.clicks,
        previous_clicks: previous ? previous.clicks : 0,
        dropped_by_3_plus: positionDelta >= 3,
        current_impressions: current!.impressions,
      };
    })
    .sort((a, b) => b.current_impressions - a.current_impressions)
    .slice(0, 200)
    .map((row) => ({
      keyword: row.keyword,
      current_position: row.current_position,
      previous_position: row.previous_position,
      position_delta: row.position_delta,
      current_clicks: row.current_clicks,
      previous_clicks: row.previous_clicks,
      dropped_by_3_plus: row.dropped_by_3_plus,
    }));
}

export async function gatherClientContexts(admin: SupabaseClient) {
  const { data: clientsRaw, error: clientsError } = await admin
    .from("clients")
    .select("*")
    .order("id", { ascending: true });
  if (clientsError) throw new Error(clientsError.message);
  const clients = (clientsRaw ?? []) as ClientRow[];
  if (clients.length === 0) return [];

  const clientIds = clients.map((client) => client.id);
  // Every read below is either one row per client or paged to the end. They
  // used to be single capped reads across all 248 clients, which the
  // database cut at 1000 rows in total, so most clients came out empty or
  // partial (found 2026-09-28).
  const all = <T,>(table: string, select: string, since?: { column: string; value: string }) =>
    fetchAllRows<T>((from, to) => {
      let query = admin.from(table).select(`${select}, id`).in("client_id", clientIds);
      if (since) query = query.gte(since.column, since.value);
      return query.order("id", { ascending: true }).range(from, to);
    }, table);

  // Search Console: each client's latest completed snapshot, and the one
  // covering the 28 days before it, for keyword periods.
  const gscSnapshots = await fetchAllRows<GscSnapshotWindow & { client_id: number }>(
    (from, to) =>
      admin
        .from("client_gsc_snapshots")
        .select("id, client_id, start_date, end_date, run_status, created_at")
        .in("client_id", clientIds)
        .eq("run_status", "completed")
        .gte("created_at", new Date(Date.now() - 120 * 86_400_000).toISOString())
        .order("id", { ascending: true })
        .range(from, to),
    "client_gsc_snapshots",
  );
  const gscPeriodsByClient = new Map<number, ReturnType<typeof pickKeywordPeriods>>();
  for (const [clientId, snaps] of groupRowsByClientId(gscSnapshots)) {
    gscPeriodsByClient.set(clientId, pickKeywordPeriods(snaps));
  }
  const currentGscIds = [...gscPeriodsByClient.values()].map((p) => p.current?.id).filter((id): id is number => id != null);
  const previousGscIds = [...gscPeriodsByClient.values()].map((p) => p.previous?.id).filter((id): id is number => id != null);
  const bySnapshot = <T,>(table: string, select: string, ids: number[]) =>
    ids.length
      ? fetchAllRows<T>(
          (from, to) => admin.from(table).select(`${select}, id`).in("snapshot_id", ids).order("id", { ascending: true }).range(from, to),
          table,
        )
      : Promise.resolve([] as T[]);

  const socialSince = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [
    adsSnapshots,
    adsSignalsRows,
    gscPageRows,
    gscSignalsRows,
    socialDailyRows,
    socialSignalsRows,
    sitemapSnapshots,
    gbpSnapshots,
    gbpReviewsRows,
    queryMetricRows,
    crawlIssuesRows,
  ] = await Promise.all([
    fetchLatestSnapshotsByClient<AdsSnapshot>(admin, "client_ads_snapshots", "*"),
    all<AdsSignal>("client_ads_signals", "*"),
    bySnapshot<GscPageMetric>("client_gsc_page_metrics", "*", currentGscIds),
    bySnapshot<GscSignal>("client_gsc_signals", "*", currentGscIds),
    all<SocialDailySnapshot>("client_social_daily_snapshots", "*", { column: "snapshot_date", value: socialSince }),
    all<SocialSignal>("client_social_signals", "*"),
    fetchLatestSnapshotsByClient<SitemapSnapshot>(admin, "client_sitemap_snapshots", "*"),
    fetchLatestSnapshotsByClient<GbpSnapshot>(admin, "client_gbp_snapshots", "*"),
    all<GbpReviewRow>("client_gbp_reviews", "*"),
    bySnapshot<{ snapshot_id: number; client_id: number; query: string; clicks: number; impressions: number; position: number }>(
      "client_gsc_query_metrics",
      "snapshot_id, client_id, query, clicks, impressions, position",
      [...currentGscIds, ...previousGscIds],
    ),
    all<{ client_id: number; id: number; severity: string }>("client_seo_crawl_issues", "client_id, severity"),
  ]);
  const newestFirst = <T extends { created_at?: string }>(rows: T[]) =>
    [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const currentGscIdSet = new Set(currentGscIds);
  const adsSignalsRaw = { data: newestFirst(adsSignalsRows) };
  const gscPageRaw = { data: gscPageRows };
  const gscSignalsRaw = { data: newestFirst(gscSignalsRows) };
  const socialDailyRaw = {
    data: [...socialDailyRows].sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date))),
  };
  const socialSignalsRaw = { data: newestFirst(socialSignalsRows) };
  const gbpReviewsRaw = {
    data: [...gbpReviewsRows].sort((a, b) => (b.review_time_unix ?? 0) - (a.review_time_unix ?? 0)),
  };
  const keywordHealthRaw = {
    data: queryMetricRows.map((row) => ({
      client_id: row.client_id,
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
      period: (currentGscIdSet.has(row.snapshot_id) ? "current" : "previous") as KeywordPeriodRow["period"],
    })),
  };
  const crawlIssuesRaw = { data: crawlIssuesRows };

  const adsSnapshotByClient = new Map(adsSnapshots.map((row) => [row.client_id, row]));
  const sitemapByClient = new Map(sitemapSnapshots.map((row) => [row.client_id, row]));
  const gbpByClient = new Map(gbpSnapshots.map((row) => [row.client_id, row]));
  const adsSignalsByClient = groupRowsByClientId((adsSignalsRaw.data ?? []) as AdsSignal[]);
  const gscPageByClient = groupRowsByClientId((gscPageRaw.data ?? []) as GscPageMetric[]);
  const gscSignalsByClient = groupRowsByClientId((gscSignalsRaw.data ?? []) as GscSignal[]);
  const socialDailyByClient = groupRowsByClientId(
    (socialDailyRaw.data ?? []) as SocialDailySnapshot[],
  );
  const socialSignalsByClient = groupRowsByClientId(
    (socialSignalsRaw.data ?? []) as SocialSignal[],
  );
  const gbpReviewsByClient = groupRowsByClientId((gbpReviewsRaw.data ?? []) as GbpReviewRow[]);
  const queryMetricsByClient = groupRowsByClientId(
    keywordHealthRaw.data as Array<KeywordPeriodRow & { client_id: number }>,
  );
  const crawlIssuesByClient = groupRowsByClientId(
    (crawlIssuesRaw.data ?? []) as Array<{ client_id: number; id: number; severity: string }>,
  );

  const contexts: ClientContext[] = [];

  for (const client of clients) {
    const clientId = client.id;
    const adsSnapshot = adsSnapshotByClient.get(clientId) ?? null;
    const adsSignals = rowsForClient(adsSignalsByClient, clientId, 250);
    const gscPageMetrics = rowsForClient(gscPageByClient, clientId, 250);
    const gscSignals = rowsForClient(gscSignalsByClient, clientId, 250);
    const socialDailyRows = rowsForClient(socialDailyByClient, clientId, 120);
    const socialSignals = rowsForClient(socialSignalsByClient, clientId, 250);
    const sitemapSnapshot = sitemapByClient.get(clientId) ?? null;
    const gbpSnapshot = gbpByClient.get(clientId) ?? null;
    const gbpReviews = rowsForClient(gbpReviewsByClient, clientId, 250);
    const queryRows = rowsForClient(queryMetricsByClient, clientId, 400);
    const keywordRows = buildKeywordRowsFromQueryMetrics(queryRows);
    const crawlIssues = rowsForClient(crawlIssuesByClient, clientId, 250);

    const technicalFindings = buildBaselineTechnicalFindings(client);
    const freshness = buildReportingFreshness({
      adsUpdatedAt: adsSnapshot?.updated_at ?? null,
      gscUpdatedAt: gscSignals[0]?.created_at ?? null,
      socialUpdatedAt: socialDailyRows[0]?.created_at ?? null,
      lighthouseOrCrawlUpdatedAt: null,
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
    const staleSourceCount = freshness.filter(
      (item) => item.source !== "ga4" && item.status !== "fresh",
    ).length;
    const technicalCriticalCount = crawlIssues.filter((row) => row.severity === "critical").length;
    const urgencyScore = computeClientUrgencyScore({
      needsReply: client.needs_reply,
      staleDays: client.days_stale,
      hasCriticalTechnical: technicalCriticalCount > 0,
      hasCriticalAds: adsSignals.some((signal) => signal.severity === "critical"),
      hasCriticalGsc: gscSignals.some((signal) => signal.severity === "critical"),
      missingScUrl: !(client.sc_url ?? "").trim(),
      missingAdsCustomerId: !(client.ads_customer_id ?? "").trim(),
      staleSourceCount,
    });

    contexts.push({
      client,
      adsSnapshot,
      adsSignals,
      gscPageMetrics,
      gscSignals,
      socialDailyRows,
      socialSignals,
      sitemapSnapshot,
      gbpSnapshot,
      gbpReviews,
      keywordRows,
      crawlIssueCount: crawlIssues.length,
      technicalCriticalCount,
      staleSourceCount,
      urgencyScore,
      freshness,
      alerts,
    });
  }

  return contexts;
}

async function upsertClientDailyMetricsRows(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const { datasetFqn } = getBigQueryDatasetRef();
  const statements = rows.map(() => `
    merge ${datasetFqn}.client_daily_metrics t
    using (
      select
        date(@metric_date) as metric_date,
        cast(@client_id as int64) as client_id,
        @client_name as client_name,
        @strategist as strategist,
        cast(@ads_clicks_30d as float64) as ads_clicks_30d,
        cast(@ads_cost_30d_usd as float64) as ads_cost_30d_usd,
        cast(@ads_ctr_30d as float64) as ads_ctr_30d,
        cast(@search_clicks_30d as float64) as search_clicks_30d,
        cast(@search_impressions_30d as float64) as search_impressions_30d,
        cast(@search_ctr_30d as float64) as search_ctr_30d,
        cast(@social_reach_30d as float64) as social_reach_30d,
        cast(@social_engagement_30d as float64) as social_engagement_30d,
        cast(@social_impressions_30d as float64) as social_impressions_30d,
        cast(@gbp_rating as float64) as gbp_rating,
        cast(@gbp_review_count as int64) as gbp_review_count,
        cast(@gbp_new_reviews_30d as int64) as gbp_new_reviews_30d,
        cast(@seo_open_issues as int64) as seo_open_issues,
        cast(@seo_critical_issues as int64) as seo_critical_issues,
        cast(@gsc_critical_signals as int64) as gsc_critical_signals,
        cast(@stale_sitemap_urls as int64) as stale_sitemap_urls,
        cast(@urgency_score as int64) as urgency_score,
        timestamp(@source_updated_at) as source_updated_at,
        timestamp(@loaded_at) as loaded_at
    ) s
    on t.metric_date = s.metric_date and t.client_id = s.client_id
    when matched then update set
      client_name = s.client_name,
      strategist = s.strategist,
      ads_clicks_30d = s.ads_clicks_30d,
      ads_cost_30d_usd = s.ads_cost_30d_usd,
      ads_ctr_30d = s.ads_ctr_30d,
      search_clicks_30d = s.search_clicks_30d,
      search_impressions_30d = s.search_impressions_30d,
      search_ctr_30d = s.search_ctr_30d,
      social_reach_30d = s.social_reach_30d,
      social_engagement_30d = s.social_engagement_30d,
      social_impressions_30d = s.social_impressions_30d,
      gbp_rating = s.gbp_rating,
      gbp_review_count = s.gbp_review_count,
      gbp_new_reviews_30d = s.gbp_new_reviews_30d,
      seo_open_issues = s.seo_open_issues,
      seo_critical_issues = s.seo_critical_issues,
      gsc_critical_signals = s.gsc_critical_signals,
      stale_sitemap_urls = s.stale_sitemap_urls,
      urgency_score = s.urgency_score,
      source_updated_at = s.source_updated_at,
      loaded_at = s.loaded_at
    when not matched then insert (
      metric_date, client_id, client_name, strategist, ads_clicks_30d, ads_cost_30d_usd,
      ads_ctr_30d, search_clicks_30d, search_impressions_30d, search_ctr_30d, social_reach_30d,
      social_engagement_30d, social_impressions_30d, gbp_rating, gbp_review_count, gbp_new_reviews_30d,
      seo_open_issues, seo_critical_issues, gsc_critical_signals, stale_sitemap_urls, urgency_score,
      source_updated_at, loaded_at
    ) values (
      s.metric_date, s.client_id, s.client_name, s.strategist, s.ads_clicks_30d, s.ads_cost_30d_usd,
      s.ads_ctr_30d, s.search_clicks_30d, s.search_impressions_30d, s.search_ctr_30d, s.social_reach_30d,
      s.social_engagement_30d, s.social_impressions_30d, s.gbp_rating, s.gbp_review_count, s.gbp_new_reviews_30d,
      s.seo_open_issues, s.seo_critical_issues, s.gsc_critical_signals, s.stale_sitemap_urls, s.urgency_score,
      s.source_updated_at, s.loaded_at
    )
  `);

  for (let idx = 0; idx < rows.length; idx += 1) {
    await runBigQueryQuery(statements[idx]!, rows[idx]);
  }
}

async function replaceDailyFactTable(
  table: "client_channel_snapshots" | "client_alert_facts" | "client_keyword_facts",
  rows: Array<Record<string, unknown>>,
  metricDate: string,
) {
  const { datasetFqn } = getBigQueryDatasetRef();
  await runBigQueryQuery(`delete from ${datasetFqn}.${table} where metric_date = date(@metricDate)`, {
    metricDate,
  });
  if (rows.length === 0) return;

  const batchInserts = rows.map((row) => {
    if (table === "client_channel_snapshots") {
      return runBigQueryQuery(
        `
          insert into ${datasetFqn}.client_channel_snapshots (
            metric_date, client_id, channel, status, freshness_status, updated_at, loaded_at
          )
          values (
            date(@metric_date), cast(@client_id as int64), @channel, @status, @freshness_status,
            timestamp(@updated_at), timestamp(@loaded_at)
          )
        `,
        row,
      );
    }
    if (table === "client_alert_facts") {
      return runBigQueryQuery(
        `
          insert into ${datasetFqn}.client_alert_facts (
            metric_date, client_id, alert_id, source, severity, title, detected_at, loaded_at
          )
          values (
            date(@metric_date), cast(@client_id as int64), @alert_id, @source, @severity, @title,
            timestamp(@detected_at), timestamp(@loaded_at)
          )
        `,
        row,
      );
    }
    return runBigQueryQuery(
      `
        insert into ${datasetFqn}.client_keyword_facts (
          metric_date, client_id, keyword, tag, priority, current_position, previous_position,
          position_delta, current_clicks, previous_clicks, dropped_by_3_plus, loaded_at
        )
        values (
          date(@metric_date), cast(@client_id as int64), @keyword, @tag, cast(@priority as int64),
          cast(@current_position as float64), cast(@previous_position as float64),
          cast(@position_delta as float64), cast(@current_clicks as float64), cast(@previous_clicks as float64),
          cast(@dropped_by_3_plus as bool), timestamp(@loaded_at)
        )
      `,
      row,
    );
  });
  await Promise.all(batchInserts);
}

export async function syncReportingToBigQuery(params: {
  admin: SupabaseClient;
  metricDate?: string;
}) {
  const startedAt = new Date().toISOString();
  const metricDate = params.metricDate ?? startedAt.slice(0, 10);
  const loadedAt = startedAt;
  const { datasetFqn } = getBigQueryDatasetRef();
  await ensureReportingModelV1({ datasetFqn });
  const contexts = await gatherClientContexts(params.admin);

  const metricRows: Array<Record<string, unknown>> = [];
  const channelRows: Array<Record<string, unknown>> = [];
  const alertRows: Array<Record<string, unknown>> = [];
  const keywordRows: Array<Record<string, unknown>> = [];

  for (const ctx of contexts) {
    const kpis = buildReportingKpis({
      adsSnapshot: ctx.adsSnapshot,
      gscPageMetrics: ctx.gscPageMetrics,
      gscSignals: ctx.gscSignals,
      gscSnapshotUpdatedAt: ctx.gscSignals[0]?.created_at ?? null,
      socialDailyRows: ctx.socialDailyRows,
      socialPostCount: 0,
      socialConnected: ctx.socialDailyRows.length > 0,
      crawlIssueCount: ctx.crawlIssueCount,
      technicalFindingCount: ctx.crawlIssueCount,
      technicalCriticalCount: ctx.technicalCriticalCount,
      sitemapSnapshot: ctx.sitemapSnapshot,
      gbpSnapshot: ctx.gbpSnapshot,
      gbpReviews: ctx.gbpReviews,
      lighthouseFetchedAt: null,
      crawlUpdatedAt: null,
    });
    const kpiMap = new Map(kpis.map((kpi) => [kpi.id, kpi.value]));
    metricRows.push({
      metric_date: metricDate,
      client_id: ctx.client.id,
      client_name: ctx.client.account_name,
      strategist: ctx.client.marketing_strategist,
      ads_clicks_30d: toNumberOrNull(kpiMap.get("ads-clicks") ?? ""),
      ads_cost_30d_usd: toNumberOrNull(kpiMap.get("ads-cost-30d") ?? ""),
      ads_ctr_30d: parsePercentValue(kpiMap.get("ads-ctr") ?? ""),
      search_clicks_30d: toNumberOrNull(kpiMap.get("gsc-clicks") ?? ""),
      search_impressions_30d: toNumberOrNull(kpiMap.get("gsc-impressions") ?? ""),
      search_ctr_30d: parsePercentValue(kpiMap.get("gsc-ctr-30d") ?? ""),
      social_reach_30d: toNumberOrNull(kpiMap.get("social-reach") ?? ""),
      social_engagement_30d: toNumberOrNull(kpiMap.get("social-engagement") ?? ""),
      social_impressions_30d: toNumberOrNull(kpiMap.get("social-impressions-30d") ?? ""),
      gbp_rating: toNumberOrNull((kpiMap.get("gbp-rating") ?? "").split("/")[0] ?? ""),
      gbp_review_count: toNumberOrNull(kpiMap.get("gbp-review-count") ?? ""),
      gbp_new_reviews_30d: toNumberOrNull(kpiMap.get("gbp-reviews-30d") ?? ""),
      seo_open_issues: toNumberOrNull(kpiMap.get("seo-open") ?? ""),
      seo_critical_issues: toNumberOrNull(kpiMap.get("seo-critical-issues") ?? ""),
      gsc_critical_signals: toNumberOrNull(kpiMap.get("gsc-critical") ?? ""),
      stale_sitemap_urls: toNumberOrNull(kpiMap.get("sitemaps-stale") ?? ""),
      urgency_score: ctx.urgencyScore,
      source_updated_at:
        ctx.adsSnapshot?.updated_at ??
        ctx.gscSignals[0]?.created_at ??
        ctx.socialDailyRows[0]?.created_at ??
        ctx.gbpSnapshot?.updated_at ??
        loadedAt,
      loaded_at: loadedAt,
    });

    for (const fresh of ctx.freshness) {
      channelRows.push({
        metric_date: metricDate,
        client_id: ctx.client.id,
        channel: fresh.source,
        status: fresh.status === "fresh" ? "ready" : "attention",
        freshness_status: fresh.status,
        updated_at: fresh.updated_at ?? loadedAt,
        loaded_at: loadedAt,
      });
    }

    for (const alert of ctx.alerts) {
      alertRows.push({
        metric_date: metricDate,
        client_id: ctx.client.id,
        alert_id: alert.id,
        source: alert.source,
        severity: alert.severity,
        title: alert.title,
        detected_at: alert.detected_at ?? loadedAt,
        loaded_at: loadedAt,
      });
    }

    for (const row of ctx.keywordRows) {
      keywordRows.push({
        metric_date: metricDate,
        client_id: ctx.client.id,
        keyword: row.keyword,
        tag: null,
        priority: 50,
        current_position: row.current_position,
        previous_position: row.previous_position,
        position_delta: row.position_delta,
        current_clicks: row.current_clicks,
        previous_clicks: row.previous_clicks,
        dropped_by_3_plus: row.dropped_by_3_plus,
        loaded_at: loadedAt,
      });
    }
  }

  await upsertClientDailyMetricsRows(metricRows);
  await replaceDailyFactTable("client_channel_snapshots", channelRows, metricDate);
  await replaceDailyFactTable("client_alert_facts", alertRows, metricDate);
  await replaceDailyFactTable("client_keyword_facts", keywordRows, metricDate);

  const finishedAt = new Date().toISOString();
  return {
    syncedClients: contexts.length,
    metricRows: metricRows.length,
    channelRows: channelRows.length,
    alertRows: alertRows.length,
    keywordRows: keywordRows.length,
    startedAt,
    finishedAt,
  } satisfies SyncOutcome;
}
