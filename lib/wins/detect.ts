import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdsSnapshot,
  Ga4Snapshot,
  GscQueryMetric,
  GscPageMetric,
  SocialPostSnapshot,
} from "@/lib/types/client";
import type { Win, WinSource } from "@/lib/wins/types";

// Keep the latest row per client from a list already sorted newest-first.
function latestPerClient<T extends { client_id: number }>(rows: T[]): Map<number, T> {
  const byClient = new Map<number, T>();
  for (const row of rows) {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, row);
  }
  return byClient;
}

function pctChange(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return null;
  return (current - previous) / previous;
}

function fmtPct(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
}

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString();
}

function fmtMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 100 ? 2 : 0 })}`;
}

async function detectGa4(admin: SupabaseClient, names: Map<number, string>): Promise<Win[]> {
  const { data } = await admin
    .from("client_ga4_snapshots")
    .select("client_id, totals, previous_totals, start_date, end_date, created_at, run_status")
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(600);
  const wins: Win[] = [];
  for (const snap of latestPerClient((data ?? []) as unknown as Ga4Snapshot[]).values()) {
    const name = names.get(snap.client_id);
    if (!name) continue;
    const t = snap.totals;
    const p = snap.previous_totals;
    if (!t || !p) continue;

    // Guard against tracking-ramp artifacts: require a real prior baseline and
    // cap at +300% (bigger jumps almost always mean the prior period undercounted
    // because GA4 was newly connected — not safe to tout publicly).
    const sessionsChange = pctChange(t.sessions, p.sessions);
    if (
      sessionsChange != null &&
      sessionsChange >= 0.2 &&
      sessionsChange <= 3 &&
      t.sessions >= 500 &&
      p.sessions >= 300
    ) {
      wins.push({
        id: `organic:${snap.client_id}:ga4_sessions`,
        source: "organic",
        channel_label: "Website traffic",
        client_id: snap.client_id,
        client_name: name,
        kind: "ga4_sessions_growth",
        metric_label: "Website sessions",
        metric_value: fmtPct(sessionsChange),
        context: `${name} grew website sessions ${fmtPct(sessionsChange)} to ${fmtInt(t.sessions)} period-over-period.`,
        period: "period-over-period",
        score: sessionsChange * Math.log10(t.sessions + 10) * 40,
      });
    }

    const convChange = pctChange(t.conversions, p.conversions);
    if (convChange != null && convChange >= 0.25 && convChange <= 3 && t.conversions >= 25 && p.conversions >= 10) {
      wins.push({
        id: `organic:${snap.client_id}:ga4_conversions`,
        source: "organic",
        channel_label: "Website traffic",
        client_id: snap.client_id,
        client_name: name,
        kind: "ga4_conversions_growth",
        metric_label: "Conversions",
        metric_value: fmtPct(convChange),
        context: `${name} grew website conversions ${fmtPct(convChange)} to ${fmtInt(t.conversions)} period-over-period.`,
        period: "period-over-period",
        score: convChange * Math.log10(t.conversions + 10) * 45,
      });
    }
  }
  return wins;
}

async function detectGsc(admin: SupabaseClient, names: Map<number, string>): Promise<Win[]> {
  const { data: snaps } = await admin
    .from("client_gsc_snapshots")
    .select("id, client_id, start_date, end_date, created_at, run_status")
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(600);
  const latest = latestPerClient(
    (snaps ?? []) as Array<{ id: number; client_id: number }>,
  );
  const snapshotIds = [...latest.values()].map((s) => s.id);
  if (!snapshotIds.length) return [];
  const snapToClient = new Map<number, number>([...latest.values()].map((s) => [s.id, s.client_id]));

  // Strong rankings: queries at average position <= 3 with real impressions.
  const { data: queries } = await admin
    .from("client_gsc_query_metrics")
    .select("snapshot_id, query, clicks, impressions, position")
    .in("snapshot_id", snapshotIds)
    .lte("position", 3)
    .gte("impressions", 50)
    .limit(5000);

  const top3ByClient = new Map<number, GscQueryMetric[]>();
  for (const q of (queries ?? []) as GscQueryMetric[]) {
    const clientId = snapToClient.get(q.snapshot_id);
    if (clientId == null) continue;
    const list = top3ByClient.get(clientId) ?? [];
    list.push(q);
    top3ByClient.set(clientId, list);
  }

  // Total organic clicks per snapshot (volume win).
  const { data: pages } = await admin
    .from("client_gsc_page_metrics")
    .select("snapshot_id, clicks")
    .in("snapshot_id", snapshotIds)
    .limit(20000);
  const clicksByClient = new Map<number, number>();
  for (const pg of (pages ?? []) as Pick<GscPageMetric, "snapshot_id" | "clicks">[]) {
    const clientId = snapToClient.get(pg.snapshot_id);
    if (clientId == null) continue;
    clicksByClient.set(clientId, (clicksByClient.get(clientId) ?? 0) + (pg.clicks ?? 0));
  }

  const wins: Win[] = [];
  for (const [clientId, qs] of top3ByClient) {
    const name = names.get(clientId);
    if (!name || qs.length < 3) continue;
    const top = [...qs].sort((a, b) => b.clicks - a.clicks)[0];
    wins.push({
      id: `organic:${clientId}:gsc_top3`,
      source: "organic",
      channel_label: "Search rankings",
      client_id: clientId,
      client_name: name,
      kind: "gsc_top3",
      metric_label: "Top-3 rankings",
      metric_value: `${qs.length} terms`,
      context: `${name} ranks in the top 3 of Google for ${qs.length} search terms (e.g. "${top.query}").`,
      period: "last 30 days",
      score: Math.min(qs.length, 60) * 2.2,
    });
  }
  for (const [clientId, clicks] of clicksByClient) {
    const name = names.get(clientId);
    if (!name || clicks < 500) continue;
    wins.push({
      id: `organic:${clientId}:gsc_clicks`,
      source: "organic",
      channel_label: "Search rankings",
      client_id: clientId,
      client_name: name,
      kind: "gsc_clicks",
      metric_label: "Organic clicks",
      metric_value: fmtInt(clicks),
      context: `${name} earned ${fmtInt(clicks)} organic clicks from Google Search in the last 30 days.`,
      period: "last 30 days",
      score: Math.log10(clicks) * 12,
    });
  }
  return wins;
}

async function detectAds(admin: SupabaseClient, names: Map<number, string>): Promise<Win[]> {
  const { data } = await admin
    .from("client_ads_snapshots")
    .select("client_id, totals, start_date, end_date, created_at, run_status")
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(400);
  const rows = (data ?? []) as unknown as AdsSnapshot[];
  // Group newest-first; index 0 = latest, index 1 = previous (for deltas).
  const byClient = new Map<number, AdsSnapshot[]>();
  for (const r of rows) {
    const list = byClient.get(r.client_id) ?? [];
    list.push(r);
    byClient.set(r.client_id, list);
  }

  const wins: Win[] = [];
  for (const [clientId, snaps] of byClient) {
    const name = names.get(clientId);
    if (!name) continue;
    const t = snaps[0]?.totals;
    if (!t) continue;
    const costDollars = (t.cost_micros ?? 0) / 1_000_000;
    const conversions = t.conversions ?? 0;
    const cpa = conversions > 0 ? costDollars / conversions : null;
    const value = t.conversions_value ?? 0;
    const roas = costDollars > 0 && value > 0 ? value / costDollars : (t.roas ?? null);

    // Credibility band: a real vet lead costs ~$3-$25. CPA below ~$3 almost always
    // means conversions are counting micro-events (page views, button clicks), not
    // leads — not safe to tout. Use it to vet all conversion-based ads wins.
    const credibleConversions = cpa != null && cpa >= 3 && cpa <= 80;
    if (cpa != null && conversions >= 15 && cpa >= 3 && cpa <= 25) {
      wins.push({
        id: `ads:${clientId}:ads_cpa`,
        source: "ads",
        channel_label: "Google Ads",
        client_id: clientId,
        client_name: name,
        kind: "ads_cpa",
        metric_label: "Cost per lead",
        metric_value: fmtMoney(cpa),
        context: `${name} is generating leads at ${fmtMoney(cpa)} cost-per-conversion (${fmtInt(conversions)} conversions in 30 days).`,
        period: "last 30 days",
        score: (30 - cpa) * 2 + Math.log10(conversions + 1) * 8,
      });
    }
    if (roas != null && roas >= 3 && roas <= 30 && value > 0) {
      wins.push({
        id: `ads:${clientId}:ads_roas`,
        source: "ads",
        channel_label: "Google Ads",
        client_id: clientId,
        client_name: name,
        kind: "ads_roas",
        metric_label: "Return on ad spend",
        metric_value: `${roas.toFixed(1)}×`,
        context: `${name}'s Google Ads delivered a ${roas.toFixed(1)}× return on ad spend in the last 30 days.`,
        period: "last 30 days",
        score: roas * 9,
      });
    }
    if (conversions >= 50 && credibleConversions) {
      wins.push({
        id: `ads:${clientId}:ads_conversions`,
        source: "ads",
        channel_label: "Google Ads",
        client_id: clientId,
        client_name: name,
        kind: "ads_conversions",
        metric_label: "Conversions",
        metric_value: fmtInt(conversions),
        context: `${name} drove ${fmtInt(conversions)} conversions from Google Ads in the last 30 days.`,
        period: "last 30 days",
        score: Math.log10(conversions) * 18,
      });
    }
    // Delta vs previous snapshot.
    const prev = snaps[1]?.totals;
    if (prev) {
      const change = pctChange(conversions, prev.conversions ?? 0);
      if (change != null && change >= 0.3 && change <= 3 && conversions >= 20 && credibleConversions) {
        wins.push({
          id: `ads:${clientId}:ads_conv_growth`,
          source: "ads",
          channel_label: "Google Ads",
          client_id: clientId,
          client_name: name,
          kind: "ads_conversions_growth",
          metric_label: "Conversion growth",
          metric_value: fmtPct(change),
          context: `${name} grew Google Ads conversions ${fmtPct(change)} to ${fmtInt(conversions)} versus the prior period.`,
          period: "period-over-period",
          score: change * 30 + Math.log10(conversions + 1) * 6,
        });
      }
    }
  }
  return wins;
}

async function detectSocial(admin: SupabaseClient, names: Map<number, string>): Promise<Win[]> {
  const since = new Date(Date.now() - 75 * 86400_000).toISOString();
  const { data } = await admin
    .from("client_social_post_snapshots")
    .select("client_id, platform, caption, engagement, reach, published_at")
    .gte("published_at", since)
    .order("engagement", { ascending: false, nullsFirst: false })
    .limit(120);
  const seen = new Set<number>();
  const wins: Win[] = [];
  for (const post of (data ?? []) as SocialPostSnapshot[]) {
    const name = names.get(post.client_id);
    const engagement = post.engagement ?? 0;
    const reach = post.reach ?? 0;
    if (!name || engagement < 50) continue;
    if (seen.has(post.client_id)) continue; // best post per client
    seen.add(post.client_id);
    const snippet = (post.caption ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    wins.push({
      id: `social:${post.client_id}:social_post`,
      source: "social",
      channel_label: "Social",
      client_id: post.client_id,
      client_name: name,
      kind: "social_top_post",
      metric_label: "Standout post",
      metric_value: `${fmtInt(engagement)} engagements`,
      context: `${name}'s ${post.platform} post drove ${fmtInt(engagement)} engagements${reach ? ` and reached ${fmtInt(reach)} people` : ""}${snippet ? ` ("${snippet}…")` : ""}.`,
      period: "last 75 days",
      score: Math.log10(engagement + 1) * 14 + Math.log10(reach + 1) * 4,
    });
  }
  return wins;
}

export async function detectWins(
  admin: SupabaseClient,
  opts?: { sources?: WinSource[]; limit?: number },
): Promise<Win[]> {
  const sources = new Set(opts?.sources ?? ["ads", "organic", "social"]);

  const { data: clientRows } = await admin.from("clients").select("id, account_name").limit(2000);
  const names = new Map<number, string>(
    (clientRows ?? []).map((c: { id: number; account_name: string }) => [c.id, c.account_name]),
  );

  const [ga4, gsc, ads, social] = await Promise.all([
    sources.has("organic") ? detectGa4(admin, names).catch(() => []) : Promise.resolve([]),
    sources.has("organic") ? detectGsc(admin, names).catch(() => []) : Promise.resolve([]),
    sources.has("ads") ? detectAds(admin, names).catch(() => []) : Promise.resolve([]),
    sources.has("social") ? detectSocial(admin, names).catch(() => []) : Promise.resolve([]),
  ]);

  // Cap each detector so one high-scoring channel (e.g. GA4 growth) can't crowd
  // out the others — Tom wants a varied menu of wins to choose from.
  const top = (arr: Win[], n: number) => [...arr].sort((a, b) => b.score - a.score).slice(0, n);
  const wins = [...top(ads, 15), ...top(ga4, 10), ...top(gsc, 14), ...top(social, 10)];
  return wins.sort((a, b) => b.score - a.score).slice(0, opts?.limit ?? 60);
}
