import { buildQualityScoreSignals } from "@/lib/ads/quality-score";
import { formatCostMicros } from "@/lib/ads/quality-score";
import type {
  AdsCampaignMetric,
  AdsKeywordQualityRow,
  AdsSnapshotSignalDraft,
} from "@/lib/types/client";

// Minimum clicks before "no conversions" becomes meaningful
const NO_CONVERSIONS_CLICK_THRESHOLD = 30;

export function buildAdsSignals(
  totals: {
    impressions: number;
    clicks: number;
    cost_micros: number;
    conversions: number;
    ctr: number;
    average_cpc: number;
    search_impression_share?: number | null;
    search_rank_lost_impression_share?: number | null;
    search_budget_lost_impression_share?: number | null;
  },
  campaigns: AdsCampaignMetric[],
  keywordQuality: AdsKeywordQualityRow[] = [],
): AdsSnapshotSignalDraft[] {
  const signals: AdsSnapshotSignalDraft[] = [];

  // --- Click / CTR ---

  if (totals.impressions > 500 && totals.clicks === 0) {
    signals.push({
      signal_id: "ads_zero_clicks",
      severity: "critical",
      title: "High impressions with zero clicks",
      description: "Ads are showing but not earning traffic.",
      suggestion: "Review ad copy relevance and tighten keyword/ad-group alignment.",
      metric_value: `${totals.impressions.toLocaleString()} impressions, 0 clicks`,
      occurrence_key: "ads_zero_clicks",
    });
  } else if (totals.ctr < 0.01 && totals.impressions > 200) {
    signals.push({
      signal_id: "ads_low_ctr",
      severity: "watch",
      title: "Low click-through rate",
      description: "CTR is below 1% — ads are showing but rarely compelling enough to click.",
      suggestion: "Test stronger headlines, CTAs, and audience/keyword targeting.",
      metric_value: `${(totals.ctr * 100).toFixed(2)}% CTR`,
      occurrence_key: "ads_low_ctr",
    });
  }

  // --- Conversions (only meaningful after sufficient clicks) ---

  if (totals.clicks >= NO_CONVERSIONS_CLICK_THRESHOLD && totals.conversions === 0) {
    signals.push({
      signal_id: "ads_no_conversions",
      severity: "critical",
      title: "No conversions after significant traffic",
      description: `${totals.clicks.toLocaleString()} clicks with zero tracked conversions — either tracking is broken or the funnel is leaking.`,
      suggestion: "Check conversion action setup in Google Ads and verify the landing page form/call tracking is firing.",
      metric_value: `${totals.clicks.toLocaleString()} clicks, 0 conversions`,
      occurrence_key: "ads_no_conversions",
    });
  }

  // --- Top-spend campaign stalled ---

  const topCampaign = [...campaigns].sort((a, b) => b.cost_micros - a.cost_micros)[0];
  if (topCampaign && topCampaign.impressions > 300 && topCampaign.clicks === 0) {
    signals.push({
      signal_id: "ads_top_campaign_stalled",
      severity: "watch",
      title: "Highest-spend campaign has impressions but no clicks",
      description: `"${topCampaign.campaign_name}" is consuming budget but earning no traffic.`,
      suggestion: "Audit this campaign's ad assets, keyword match types, and audience targeting.",
      metric_value: `${topCampaign.campaign_name}: ${topCampaign.impressions.toLocaleString()} impressions / 0 clicks — ${formatCostMicros(topCampaign.cost_micros)} spend`,
      occurrence_key: `ads_campaign_${topCampaign.campaign_id}_stalled`,
    });
  }

  // --- Impression share signals ---

  const sis = totals.search_impression_share;
  const rankLost = totals.search_rank_lost_impression_share;
  const budgetLost = totals.search_budget_lost_impression_share;

  if (typeof budgetLost === "number" && budgetLost > 0.25) {
    signals.push({
      signal_id: "ads_budget_lost_impression_share",
      severity: budgetLost > 0.4 ? "critical" : "watch",
      title: "Losing impression share due to budget",
      description: `Ads are not showing for ${Math.round(budgetLost * 100)}% of eligible searches because daily budget runs out.`,
      suggestion: "Increase daily budget, tighten targeting to reduce waste, or use a shared budget across campaigns.",
      metric_value: `${Math.round(budgetLost * 100)}% impressions lost to budget`,
      occurrence_key: "ads_budget_lost_impression_share",
    });
  }

  if (typeof rankLost === "number" && rankLost > 0.3) {
    signals.push({
      signal_id: "ads_rank_lost_impression_share",
      severity: rankLost > 0.5 ? "critical" : "watch",
      title: "Losing impression share due to ad rank",
      description: `Ads are not showing for ${Math.round(rankLost * 100)}% of eligible searches because bids or Quality Scores are too low.`,
      suggestion: "Improve Quality Scores on underperforming keywords or increase bids on high-value terms.",
      metric_value: `${Math.round(rankLost * 100)}% impressions lost to rank`,
      occurrence_key: "ads_rank_lost_impression_share",
    });
  }

  if (typeof sis === "number" && sis < 0.2 && totals.cost_micros > 1_000_000) {
    signals.push({
      signal_id: "ads_low_impression_share",
      severity: "watch",
      title: "Very low search impression share",
      description: `Account is only appearing in ${Math.round(sis * 100)}% of relevant searches — significant reach is being missed.`,
      suggestion: "Review budget caps, bid strategy, and keyword match types to capture more of the available market.",
      metric_value: `${Math.round(sis * 100)}% search impression share`,
      occurrence_key: "ads_low_impression_share",
    });
  }

  // --- Per-campaign impression share (high-spend campaigns with low share) ---

  for (const campaign of campaigns) {
    const camBudgetLost = campaign.search_budget_lost_impression_share;
    const camRankLost = campaign.search_rank_lost_impression_share;

    if (typeof camBudgetLost === "number" && camBudgetLost > 0.35 && campaign.cost_micros > 500_000) {
      signals.push({
        signal_id: "ads_campaign_budget_limited",
        severity: "watch",
        title: "Campaign budget-limited",
        description: `"${campaign.campaign_name}" is missing ${Math.round(camBudgetLost * 100)}% of eligible impressions because it hits its daily budget cap.`,
        suggestion: "Raise this campaign's daily budget or reduce spend on lower-priority campaigns to shift budget here.",
        metric_value: `${campaign.campaign_name}: ${Math.round(camBudgetLost * 100)}% lost to budget`,
        occurrence_key: `ads_campaign_${campaign.campaign_id}_budget_limited`,
      });
    }

    if (typeof camRankLost === "number" && camRankLost > 0.45 && campaign.cost_micros > 500_000) {
      signals.push({
        signal_id: "ads_campaign_rank_limited",
        severity: "watch",
        title: "Campaign losing impressions to low ad rank",
        description: `"${campaign.campaign_name}" is missing ${Math.round(camRankLost * 100)}% of eligible impressions due to low bids or Quality Score.`,
        suggestion: "Review keyword-level Quality Scores in this campaign and increase bids or improve ad/landing page relevance.",
        metric_value: `${campaign.campaign_name}: ${Math.round(camRankLost * 100)}% lost to rank`,
        occurrence_key: `ads_campaign_${campaign.campaign_id}_rank_limited`,
      });
    }
  }

  signals.push(...buildQualityScoreSignals(keywordQuality));

  return signals;
}
