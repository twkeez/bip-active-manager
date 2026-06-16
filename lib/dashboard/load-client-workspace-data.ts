import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDaysAgo } from "@/lib/time";
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import {
  fetchLatestSnapshotsByClient,
  fetchLighthouseSnapshot,
} from "@/lib/dashboard/snapshot-queries";
import type {
  AdsSignal,
  AdsSnapshot,
  BasecampThreadEvent,
  ClientRow,
  GbpReviewRow,
  GbpSnapshot,
  GscPageMetric,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
  LighthouseOccurrenceOverride,
  LighthouseSnapshot,
  SeoCrawlIssue,
  SeoCrawlSnapshot,
  SitemapSnapshot,
  SitemapUrlRow,
  SocialConnection,
  SocialDailySnapshot,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";

async function fetchLatestSnapshotForClient<T extends { id: number }>(
  supabase: SupabaseClient,
  table: string,
  clientId: number,
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as T;
}

export async function loadClientWorkspaceData(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientWorkspaceInitialData | null> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();
  if (clientError || !client) return null;

  const threadsCutoffIso = isoDaysAgo(30);
  const { data: threadEventsRaw } = await supabase
    .from("basecamp_communication_events")
    .select(
      "id,client_id,basecamp_project_id,basecamp_recording_id,parent_recording_id,kind,occurred_at,author_email,is_internal,thread_title,thread_excerpt,thread_body,thread_url",
    )
    .eq("client_id", clientId)
    .gte("occurred_at", threadsCutoffIso)
    .order("occurred_at", { ascending: false })
    .limit(200);
  const threadEvents = (threadEventsRaw ?? []) as BasecampThreadEvent[];

  const lighthouseSnapshot: LighthouseSnapshot | null = await fetchLighthouseSnapshot(
    supabase,
    clientId,
  );

  const { data: lighthouseOverridesRaw } = await supabase
    .from("client_lighthouse_occurrence_overrides")
    .select("id,client_id,audit_id,occurrence_key,decision,created_at")
    .eq("client_id", clientId)
    .eq("decision", "no_fix_needed");
  const lighthouseOverrides = (lighthouseOverridesRaw ??
    []) as LighthouseOccurrenceOverride[];

  let seoCrawlSnapshot: SeoCrawlSnapshot | null = null;
  let seoCrawlIssues: SeoCrawlIssue[] = [];
  seoCrawlSnapshot = await fetchLatestSnapshotForClient<SeoCrawlSnapshot>(
    supabase,
    "client_seo_crawl_snapshots",
    clientId,
  );
  if (seoCrawlSnapshot) {
    const issuesQuery = await supabase
      .from("client_seo_crawl_issues")
      .select("*")
      .eq("snapshot_id", seoCrawlSnapshot.id)
      .order("created_at", { ascending: false });
    if (!issuesQuery.error) {
      seoCrawlIssues = (issuesQuery.data ?? []) as SeoCrawlIssue[];
    }
  }

  let gscSnapshot: GscSnapshot | null = null;
  let gscSignals: GscSignal[] = [];
  let gscPageMetrics: GscPageMetric[] = [];
  let gscQueryMetrics: GscQueryMetric[] = [];
  gscSnapshot = await fetchLatestSnapshotForClient<GscSnapshot>(
    supabase,
    "client_gsc_snapshots",
    clientId,
  );
  if (gscSnapshot) {
    const [signalsQuery, pageMetricsQuery, queryMetricsQuery] = await Promise.all([
      supabase
        .from("client_gsc_signals")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_gsc_page_metrics")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("impressions", { ascending: false })
        .limit(250),
      supabase
        .from("client_gsc_query_metrics")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("impressions", { ascending: false })
        .limit(250),
    ]);
    if (!signalsQuery.error) gscSignals = (signalsQuery.data ?? []) as GscSignal[];
    if (!pageMetricsQuery.error) {
      gscPageMetrics = (pageMetricsQuery.data ?? []) as GscPageMetric[];
    }
    if (!queryMetricsQuery.error) {
      gscQueryMetrics = (queryMetricsQuery.data ?? []) as GscQueryMetric[];
    }
  }

  let sitemapSnapshot: SitemapSnapshot | null = null;
  let sitemapUrls: SitemapUrlRow[] = [];
  sitemapSnapshot = await fetchLatestSnapshotForClient<SitemapSnapshot>(
    supabase,
    "client_sitemap_snapshots",
    clientId,
  );
  if (sitemapSnapshot) {
    const urlsQuery = await supabase
      .from("client_sitemap_urls")
      .select("*")
      .eq("snapshot_id", sitemapSnapshot.id)
      .order("effective_updated_at", { ascending: true })
      .limit(1000);
    if (!urlsQuery.error) {
      sitemapUrls = (urlsQuery.data ?? []) as SitemapUrlRow[];
    }
  }

  const [connectionsQuery, dailyQuery, postsQuery, signalsQuery] = await Promise.all([
    supabase
      .from("client_social_connections")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("client_social_daily_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("snapshot_date", { ascending: false })
      .limit(500),
    supabase
      .from("client_social_post_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("published_at", { ascending: false })
      .limit(500),
    supabase
      .from("client_social_signals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const socialConnections = (connectionsQuery.data ?? []) as SocialConnection[];
  const socialDailySnapshots = (dailyQuery.data ?? []) as SocialDailySnapshot[];
  const socialPostSnapshots = (postsQuery.data ?? []) as SocialPostSnapshot[];
  const socialSignals = (signalsQuery.data ?? []) as SocialSignal[];

  let adsSnapshot: AdsSnapshot | null = null;
  let adsSignals: AdsSignal[] = [];
  const adsSnapshots = await fetchLatestSnapshotsByClient<AdsSnapshot>(
    supabase,
    "client_ads_snapshots",
    "*",
    clientId,
  );
  adsSnapshot = adsSnapshots[0] ?? null;
  if (adsSnapshot) {
    const adsSignalsQuery = await supabase
      .from("client_ads_signals")
      .select("*")
      .eq("snapshot_id", adsSnapshot.id)
      .order("created_at", { ascending: false });
    if (!adsSignalsQuery.error) {
      adsSignals = (adsSignalsQuery.data ?? []) as AdsSignal[];
    }
  }

  let gbpSnapshot: GbpSnapshot | null = null;
  let gbpReviews: GbpReviewRow[] = [];
  gbpSnapshot = await fetchLatestSnapshotForClient<GbpSnapshot>(
    supabase,
    "client_gbp_snapshots",
    clientId,
  );
  if (gbpSnapshot) {
    const reviewsQuery = await supabase
      .from("client_gbp_reviews")
      .select("*")
      .eq("snapshot_id", gbpSnapshot.id)
      .order("review_time_unix", { ascending: false, nullsFirst: false })
      .limit(500);
    if (!reviewsQuery.error) {
      gbpReviews = (reviewsQuery.data ?? []) as GbpReviewRow[];
    }
  }

  let hasDuplicateBasecampProjectId = false;
  const projectId = client.basecamp_project_id?.trim();
  if (projectId) {
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("basecamp_project_id", projectId);
    hasDuplicateBasecampProjectId = (count ?? 0) > 1;
  }

  return {
    client,
    threadEvents,
    lighthouseSnapshot,
    lighthouseOverrides,
    seoCrawlSnapshot,
    seoCrawlIssues,
    gscSnapshot,
    gscSignals,
    gscPageMetrics,
    gscQueryMetrics,
    sitemapSnapshot,
    sitemapUrls,
    socialConnections,
    socialDailySnapshots,
    socialPostSnapshots,
    socialSignals,
    adsSnapshot,
    adsSignals,
    gbpSnapshot,
    gbpReviews,
    hasDuplicateBasecampProjectId,
  };
}

export function workspaceDataToManagerProps(data: ClientWorkspaceInitialData) {
  const clientId = data.client.id;
  return {
    initialClients: [data.client],
    initialThreadEvents: data.threadEvents,
    initialLighthouseSnapshots: data.lighthouseSnapshot ? [data.lighthouseSnapshot] : [],
    initialLighthouseOverrides: data.lighthouseOverrides,
    initialSeoCrawlSnapshots: data.seoCrawlSnapshot ? [data.seoCrawlSnapshot] : [],
    initialSeoCrawlIssues: data.seoCrawlIssues,
    initialGscSnapshots: data.gscSnapshot ? [data.gscSnapshot] : [],
    initialGscSignals: data.gscSignals,
    initialGscPageMetrics: data.gscPageMetrics,
    initialGscQueryMetrics: data.gscQueryMetrics,
    initialSitemapSnapshots: data.sitemapSnapshot ? [data.sitemapSnapshot] : [],
    initialSitemapUrls: data.sitemapUrls,
    initialSocialConnections: data.socialConnections,
    initialSocialDailySnapshots: data.socialDailySnapshots,
    initialSocialPostSnapshots: data.socialPostSnapshots,
    initialSocialSignals: data.socialSignals,
    initialAdsSnapshots: data.adsSnapshot ? [data.adsSnapshot] : [],
    initialAdsSignals: data.adsSignals,
    initialGbpSnapshots: data.gbpSnapshot ? [data.gbpSnapshot] : [],
    initialGbpReviews: data.gbpReviews,
    duplicateProjectIdCounts: data.hasDuplicateBasecampProjectId
      ? {
          [data.client.basecamp_project_id!.trim()]: 2,
        }
      : {},
    workspaceClientId: clientId,
  };
}
