import type { SocialDailySnapshot, SocialPostSnapshot } from "@/lib/types/client";

type SocialSignalDraft = {
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  platform: "facebook" | "instagram" | "combined";
};

export function buildSocialSignals(
  dailyRows: SocialDailySnapshot[],
  postRows: SocialPostSnapshot[],
): SocialSignalDraft[] {
  const signals: SocialSignalDraft[] = [];
  const daily = [...dailyRows].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  const thisWeek = daily.slice(0, 7);
  const priorWeek = daily.slice(7, 14);
  const sum = (rows: SocialDailySnapshot[], key: keyof SocialDailySnapshot) =>
    rows.reduce((acc, row) => acc + (typeof row[key] === "number" ? (row[key] as number) : 0), 0);

  const thisReach = sum(thisWeek, "reach");
  const lastReach = sum(priorWeek, "reach");
  if (thisWeek.length >= 3 && priorWeek.length >= 3 && lastReach > 0) {
    const dropPct = ((lastReach - thisReach) / lastReach) * 100;
    if (dropPct >= 25) {
      signals.push({
        signal_id: "reach_drop_week_over_week",
        platform: "combined",
        severity: dropPct >= 40 ? "critical" : "watch",
        title: "Reach dropped week-over-week",
        description: "Recent 7-day reach is down compared to the prior 7 days.",
        suggestion: "Audit posting cadence and creative mix; schedule higher-performing formats this week.",
        metric_value: `${dropPct.toFixed(1)}% drop (${thisReach} vs ${lastReach})`,
      });
    }
  }

  const thisImpressions = sum(thisWeek, "impressions");
  const thisEngagement = sum(thisWeek, "engagement");
  if (thisImpressions > 0) {
    const er = thisEngagement / thisImpressions;
    if (er < 0.01) {
      signals.push({
        signal_id: "low_engagement_rate_week",
        platform: "combined",
        severity: er < 0.006 ? "critical" : "watch",
        title: "Low social engagement rate",
        description: "Engagement rate over the last 7 days is below target.",
        suggestion: "Test stronger hooks and CTA variants; use short video/reel formats where possible.",
        metric_value: `${(er * 100).toFixed(2)}%`,
      });
    }
  }

  if (postRows.length >= 6) {
    const sorted = [...postRows].sort(
      (a, b) => (b.engagement ?? 0) - (a.engagement ?? 0),
    );
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top && bottom && (top.engagement ?? 0) >= 3 * Math.max(1, bottom.engagement ?? 0)) {
      signals.push({
        signal_id: "high_post_variance",
        platform: "combined",
        severity: "watch",
        title: "High performance gap between top and bottom posts",
        description: "Recent posts show a large variance in engagement outcomes.",
        suggestion: "Reuse winning themes from top posts and retire low-performing content patterns.",
        metric_value: `Top ${top.engagement ?? 0} vs bottom ${bottom.engagement ?? 0} engagements`,
      });
    }
  }

  return signals;
}
