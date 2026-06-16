import type { KpiSummaryItem } from "@/components/dashboard/kpi-summary-grid";
import type {
  AdsSnapshot,
  GscPageMetric,
  GscSignal,
  LighthouseSnapshot,
} from "@/lib/types/client";

function sumGscMetric(rows: GscPageMetric[], key: "clicks" | "impressions") {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function weightedGscPosition(rows: GscPageMetric[]) {
  const numerator = rows.reduce(
    (sum, row) => sum + row.position * Math.max(1, row.impressions),
    0,
  );
  const denominator = rows.reduce((sum, row) => sum + Math.max(1, row.impressions), 0);
  return denominator > 0 ? numerator / denominator : null;
}

function signalChangeText(critical: number, watch: number) {
  if (critical > 0) {
    return {
      changeText: `${critical} critical signal${critical === 1 ? "" : "s"}`,
      changeTrend: "down" as const,
    };
  }
  if (watch > 0) {
    return {
      changeText: `${watch} watch signal${watch === 1 ? "" : "s"}`,
      changeTrend: "neutral" as const,
    };
  }
  return {
    changeText: "No open signals",
    changeTrend: "neutral" as const,
  };
}

export function buildSeoKpiSummary(params: {
  gscPageMetrics: GscPageMetric[];
  gscSignals: GscSignal[];
  crawlIssueCount: number;
  lighthouse: LighthouseSnapshot | null;
}): KpiSummaryItem[] {
  const clicks = sumGscMetric(params.gscPageMetrics, "clicks");
  const impressions = sumGscMetric(params.gscPageMetrics, "impressions");
  const avgPosition = weightedGscPosition(params.gscPageMetrics);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const criticalSignals = params.gscSignals.filter((signal) => signal.severity === "critical").length;
  const watchSignals = params.gscSignals.filter((signal) => signal.severity === "watch").length;
  const signalMeta = signalChangeText(criticalSignals, watchSignals);

  const crawlMeta =
    params.crawlIssueCount > 0
      ? {
          changeText: `${params.crawlIssueCount} crawl issue${params.crawlIssueCount === 1 ? "" : "s"}`,
          changeTrend: "down" as const,
        }
      : {
          changeText: "Crawl clean",
          changeTrend: "neutral" as const,
        };

  const lighthouseScore = params.lighthouse?.scores.performance;
  const lighthouseMeta =
    lighthouseScore == null
      ? { changeText: "Lighthouse not run", changeTrend: "neutral" as const }
      : lighthouseScore >= 90
        ? { changeText: "Strong performance", changeTrend: "up" as const }
        : lighthouseScore >= 50
          ? { changeText: "Room to improve", changeTrend: "neutral" as const }
          : { changeText: "Needs attention", changeTrend: "down" as const };

  return [
    {
      id: "seo-gsc-clicks",
      label: "GSC clicks",
      value: params.gscPageMetrics.length > 0 ? clicks.toLocaleString() : "Not synced",
      changeText: ctr == null ? signalMeta.changeText : `${ctr.toFixed(1)}% CTR`,
      changeTrend: ctr == null ? signalMeta.changeTrend : ctr >= 2 ? "up" : "neutral",
    },
    {
      id: "seo-gsc-impressions",
      label: "GSC impressions",
      value: params.gscPageMetrics.length > 0 ? impressions.toLocaleString() : "Not synced",
      ...signalMeta,
    },
    {
      id: "seo-position-or-lighthouse",
      label: avgPosition != null ? "Avg position" : "Performance",
      value:
        avgPosition != null
          ? avgPosition.toFixed(1)
          : lighthouseScore == null
            ? "Not synced"
            : `${lighthouseScore}`,
      ...(avgPosition != null
        ? {
            changeText:
              avgPosition <= 10
                ? "Top 10 avg position"
                : avgPosition <= 20
                  ? "Page 2 territory"
                  : "Deep rankings",
            changeTrend: (avgPosition <= 10 ? "up" : avgPosition <= 20 ? "neutral" : "down") as
              | "up"
              | "down"
              | "neutral",
          }
        : crawlMeta.changeText.includes("issue")
          ? crawlMeta
          : lighthouseMeta),
    },
  ];
}

export function buildAdsKpiSummary(params: {
  adsSnapshot: AdsSnapshot | null;
  adsCriticalSignalCount: number;
  adsWatchSignalCount: number;
}): KpiSummaryItem[] {
  const totals = params.adsSnapshot?.totals;
  const signalMeta = signalChangeText(params.adsCriticalSignalCount, params.adsWatchSignalCount);
  const conversionRate =
    totals && totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : null;
  const searchIs =
    totals && typeof totals.search_impression_share === "number"
      ? totals.search_impression_share * 100
      : null;
  const budgetLost =
    totals && typeof totals.search_budget_lost_impression_share === "number"
      ? totals.search_budget_lost_impression_share * 100
      : null;

  return [
    {
      id: "ads-clicks",
      label: "Clicks (30d)",
      value: totals ? Math.round(totals.clicks).toLocaleString() : "Not synced",
      changeText:
        conversionRate == null
          ? signalMeta.changeText
          : `${conversionRate.toFixed(1)}% conv. rate`,
      changeTrend:
        conversionRate == null
          ? signalMeta.changeTrend
          : conversionRate >= 3
            ? "up"
            : conversionRate >= 1
              ? "neutral"
              : "down",
    },
    {
      id: "ads-conversions",
      label: "Conversions (30d)",
      value: totals ? Math.round(totals.conversions).toLocaleString() : "Not synced",
      ...signalMeta,
    },
    {
      id: "ads-search-is",
      label: "Search IS",
      value: searchIs == null ? "Not synced" : `${searchIs.toFixed(1)}%`,
      changeText:
        budgetLost == null
          ? "30-day snapshot"
          : budgetLost >= 15
            ? `${budgetLost.toFixed(1)}% lost to budget`
            : `${budgetLost.toFixed(1)}% budget loss`,
      changeTrend:
        budgetLost == null ? "neutral" : budgetLost >= 15 ? "down" : budgetLost <= 5 ? "up" : "neutral",
    },
  ];
}
