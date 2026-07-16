import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { computeSpendTrend, type SpendTrend } from "@/lib/ads/spend-trend";
import type { ClientRow } from "@/lib/types/client";

// How far back to pull snapshot history, and a safety cap on rows scanned.
const HISTORY_DAYS = 180;
const ROW_CAP = 6000;

export type ClientSpendTrend = {
  clientId: number;
  accountName: string;
  trend: SpendTrend;
};

// A "typical vet practice" benchmark, drawn from the actual current spend across
// the clients we run ads for.
export type SpendBenchmark = {
  count: number;
  median: number;
  p25: number;
  p75: number;
  mean: number;
} | null;

export type SpendTrendsData = {
  clients: ClientSpendTrend[];
  summary: { adsClients: number; rising: number; flat: number; falling: number; insufficient: number };
  benchmark: SpendBenchmark;
  lastSyncAt: string | null;
  loadError: string | null;
};

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

// Linear-interpolated quantile over an ascending-sorted array.
function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAsc[base + 1] ?? sortedAsc[base];
  return sortedAsc[base] + rest * (next - sortedAsc[base]);
}

type SnapRow = {
  client_id: number;
  created_at: string;
  totals: { cost_micros?: number } | null;
};

export async function loadSpendTrends(supabase: SupabaseClient): Promise<SpendTrendsData> {
  const [{ data: clientsRaw, error: clientsError }, { data: snapsRaw, error: snapsError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, account_name, ads_customer_id")
        .order("account_name", { ascending: true }),
      supabase
        .from("client_ads_snapshots")
        .select("client_id, created_at, totals")
        .eq("run_status", "completed")
        .gte("created_at", isoDaysAgo(HISTORY_DAYS))
        .order("created_at", { ascending: true })
        .limit(ROW_CAP),
    ]);

  if (clientsError || snapsError) {
    return {
      clients: [],
      summary: { adsClients: 0, rising: 0, flat: 0, falling: 0, insufficient: 0 },
      benchmark: null,
      lastSyncAt: null,
      loadError: (clientsError ?? snapsError)?.message ?? "Failed to load ad spend trends",
    };
  }

  const clients = (clientsRaw ?? []) as Pick<ClientRow, "id" | "account_name" | "ads_customer_id">[];
  const adsClients = clients.filter((c) => isSyncableAdsCustomerId(c.ads_customer_id));

  const snaps = (snapsRaw ?? []) as SnapRow[];
  const byClient = new Map<number, { date: string; spendUsd: number }[]>();
  let lastSyncAt: string | null = null;
  for (const s of snaps) {
    if (!lastSyncAt || s.created_at > lastSyncAt) lastSyncAt = s.created_at;
    const micros = s.totals?.cost_micros ?? 0;
    const arr = byClient.get(s.client_id) ?? [];
    arr.push({ date: s.created_at, spendUsd: micros / 1_000_000 });
    byClient.set(s.client_id, arr);
  }

  const result: ClientSpendTrend[] = adsClients.map((c) => ({
    clientId: c.id,
    accountName: c.account_name ?? "Unnamed client",
    trend: computeSpendTrend(byClient.get(c.id) ?? []),
  }));

  // Rising first (largest increase on top), then flat, falling, then the
  // clients we can't call yet.
  const rank = (t: SpendTrend) =>
    t.status === "ok" ? (t.direction === "rising" ? 0 : t.direction === "flat" ? 1 : 2) : 3;
  result.sort((a, b) => {
    const ra = rank(a.trend);
    const rb = rank(b.trend);
    if (ra !== rb) return ra - rb;
    const pa = a.trend.status === "ok" ? a.trend.pctChange : -Infinity;
    const pb = b.trend.status === "ok" ? b.trend.pctChange : -Infinity;
    return pb - pa;
  });

  const isDir = (r: ClientSpendTrend, d: "rising" | "flat" | "falling") =>
    r.trend.status === "ok" && r.trend.direction === d;

  // Benchmark: current spend across every client with a real (outlier-cleaned)
  // spend figure, trend history or not. Median + middle-50% range so a few
  // very large or tiny accounts don't distort the "typical" number.
  const spendVals = result
    .map((r) => r.trend.currentSpend)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);
  const benchmark: SpendBenchmark =
    spendVals.length >= 3
      ? {
          count: spendVals.length,
          median: quantile(spendVals, 0.5),
          p25: quantile(spendVals, 0.25),
          p75: quantile(spendVals, 0.75),
          mean: spendVals.reduce((s, v) => s + v, 0) / spendVals.length,
        }
      : null;

  return {
    clients: result,
    summary: {
      adsClients: adsClients.length,
      rising: result.filter((r) => isDir(r, "rising")).length,
      flat: result.filter((r) => isDir(r, "flat")).length,
      falling: result.filter((r) => isDir(r, "falling")).length,
      insufficient: result.filter((r) => r.trend.status === "insufficient").length,
    },
    benchmark,
    lastSyncAt,
    loadError: null,
  };
}
