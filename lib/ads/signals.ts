import { buildQualityScoreSignals } from "@/lib/ads/quality-score";
import type {
  AdsCampaignMetric,
  AdsKeywordQualityRow,
  AdsSnapshotSignalDraft,
} from "@/lib/types/client";

export function buildAdsSignals(
  totals: {
    impressions: number;
    clicks: number;
    cost_micros: number;
    conversions: number;
    ctr: number;
    average_cpc: number;
  },
  campaigns: AdsCampaignMetric[],
  keywordQuality: AdsKeywordQualityRow[] = [],
): AdsSnapshotSignalDraft[] {
  const signals: AdsSnapshotSignalDraft[] = [];

  if (totals.impressions > 500 && totals.clicks === 0) {
    signals.push({
      signal_id: "ads_zero_clicks",
      severity: "critical",
      title: "High impressions with zero clicks",
      description: "Ads are showing but not earning traffic.",
      suggestion: "Review ad copy relevance and tighten keyword/ad-group alignment.",
      metric_value: `${totals.impressions} impressions, 0 clicks`,
      occurrence_key: "ads_zero_clicks",
    });
  } else if (totals.ctr < 0.01 && totals.impressions > 200) {
    signals.push({
      signal_id: "ads_low_ctr",
      severity: "watch",
      title: "Low click-through rate",
      description: "CTR is below expected baseline for active campaigns.",
      suggestion: "Test stronger headlines, CTAs, and audience/keyword targeting.",
      metric_value: `${(totals.ctr * 100).toFixed(2)}% CTR`,
      occurrence_key: "ads_low_ctr",
    });
  }

  if (totals.clicks > 0 && totals.conversions === 0) {
    signals.push({
      signal_id: "ads_no_conversions",
      severity: "critical",
      title: "Clicks without conversions",
      description: "Campaigns are generating visits but no tracked conversions.",
      suggestion: "Validate conversion tracking and landing page funnel.",
      metric_value: `${totals.clicks} clicks, 0 conversions`,
      occurrence_key: "ads_no_conversions",
    });
  }

  const topCampaign = campaigns[0];
  if (topCampaign && topCampaign.impressions > 300 && topCampaign.clicks === 0) {
    signals.push({
      signal_id: "ads_top_campaign_stalled",
      severity: "watch",
      title: "Top campaign has impressions but no clicks",
      description: "Highest-volume campaign may be underperforming.",
      suggestion: "Audit this campaign’s ad assets and targeting settings.",
      metric_value: `${topCampaign.campaign_name}: ${topCampaign.impressions} impressions / ${topCampaign.clicks} clicks`,
      occurrence_key: `ads_campaign_${topCampaign.campaign_id}_stalled`,
    });
  }

  signals.push(...buildQualityScoreSignals(keywordQuality));

  return signals;
}
