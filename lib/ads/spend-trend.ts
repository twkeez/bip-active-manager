// Robust ad-spend trend from accumulated 30-day snapshot totals.
//
// Each ads snapshot is a trailing-30-day spend total stamped at sync time, so a
// client's snapshot history is a coarse, irregularly-sampled series. To read a
// trend without being fooled by bad data we (1) thin to one point per week —
// consecutive 30d-rolling snapshots overlap almost entirely — (2) drop points
// that are almost certainly wrong (nonpositive spend, or far from the client's
// own median via a MAD-based modified z-score), then (3) compare a robust
// baseline (median of the earlier half) to recent (median of the later half).

export type SpendPoint = { date: string; spendUsd: number };

export type SpendTrend =
  | {
      status: "insufficient";
      reason: string;
      sampleCount: number;
      currentSpend: number | null;
      points: SpendPoint[];
    }
  | {
      status: "ok";
      direction: "rising" | "flat" | "falling";
      pctChange: number;
      currentSpend: number;
      baselineSpend: number;
      points: SpendPoint[];
      droppedCount: number;
      spanDays: number;
      sampleCount: number;
    };

// A move under this magnitude reads as flat — the data is a coarse 30d rolling
// total, so small wiggles aren't a real trend.
const RISE_THRESHOLD = 10; // percent
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 14;
const MAD_Z = 3.5; // modified z-score cutoff (Iglewicz-Hoaglin)

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Fixed 7-day buckets from the epoch, so nearby syncs collapse to one point.
function weekBucket(iso: string): number {
  return Math.floor(new Date(iso).getTime() / (7 * 86_400_000));
}

// Keep the latest snapshot in each week — raw runs cluster otherwise.
export function thinWeekly(points: SpendPoint[]): SpendPoint[] {
  const byBucket = new Map<number, SpendPoint>();
  for (const p of points) {
    const b = weekBucket(p.date);
    const existing = byBucket.get(b);
    if (!existing || p.date > existing.date) byBucket.set(b, p);
  }
  return [...byBucket.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Drop bad-data points: nonpositive spend (usually a failed/empty pull), then
// values far from the client's own median. Returns kept points + drop count.
export function rejectOutliers(points: SpendPoint[]): { kept: SpendPoint[]; dropped: number } {
  const positive = points.filter((p) => p.spendUsd > 0);
  const droppedZero = points.length - positive.length;
  if (positive.length < 3) return { kept: positive, dropped: droppedZero };
  const values = positive.map((p) => p.spendUsd);
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med)));
  if (mad === 0) return { kept: positive, dropped: droppedZero };
  const kept = positive.filter((p) => Math.abs((0.6745 * (p.spendUsd - med)) / mad) <= MAD_Z);
  return { kept, dropped: droppedZero + (positive.length - kept.length) };
}

export function computeSpendTrend(raw: SpendPoint[]): SpendTrend {
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  const thinned = thinWeekly(sorted);
  const { kept, dropped } = rejectOutliers(thinned);
  const sampleCount = kept.length;
  const lastRaw = sorted.length ? sorted[sorted.length - 1].spendUsd : null;
  const currentSpend = kept.length ? kept[kept.length - 1].spendUsd : lastRaw;

  if (kept.length < MIN_POINTS) {
    return {
      status: "insufficient",
      reason: "Need a few weeks of syncs to trend.",
      sampleCount,
      currentSpend,
      points: kept,
    };
  }

  const first = kept[0];
  const last = kept[kept.length - 1];
  const spanDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000;
  if (spanDays < MIN_SPAN_DAYS) {
    return {
      status: "insufficient",
      reason: "History spans too short a window.",
      sampleCount,
      currentSpend,
      points: kept,
    };
  }

  const half = Math.max(1, Math.floor(kept.length / 2));
  const baseline = median(kept.slice(0, half).map((p) => p.spendUsd));
  const recent = median(kept.slice(Math.ceil(kept.length / 2)).map((p) => p.spendUsd));
  const pctChange = baseline === 0 ? 0 : ((recent - baseline) / baseline) * 100;
  const direction =
    pctChange >= RISE_THRESHOLD ? "rising" : pctChange <= -RISE_THRESHOLD ? "falling" : "flat";

  return {
    status: "ok",
    direction,
    pctChange,
    currentSpend: last.spendUsd,
    baselineSpend: baseline,
    points: kept,
    droppedCount: dropped,
    spanDays: Math.round(spanDays),
    sampleCount,
  };
}
