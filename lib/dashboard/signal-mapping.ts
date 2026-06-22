// Canonical mapping for the platform's channel signals (client_gsc_signals /
// client_ads_signals / client_ga4_signals / client_social_signals). This is the
// single source of truth for how a signal's channel maps to a label + the
// client-detail tab it deep-links to, plus the ads "affected keywords" lookup.
// Both the "Attention Needed" panel and the strategist cockpit consume it so the
// two never drift apart.

import type { AdsSnapshot } from "@/lib/types/client";

export type SignalChannelSource = "ads" | "seo" | "analytics" | "social";

/** Human label shown on cards / chips. */
export const SIGNAL_CHANNEL_LABEL: Record<SignalChannelSource, string> = {
  ads: "Ads",
  seo: "SEO",
  analytics: "Analytics",
  social: "Social",
};

/** Client-detail tab key each channel deep-links to (?tab=…). Analytics lives
 *  under the "reporting" tab, matching the Attention Needed panel. */
export const SIGNAL_CHANNEL_TAB: Record<SignalChannelSource, string> = {
  ads: "ads",
  seo: "seo",
  analytics: "reporting",
  social: "social",
};

/** Path a channel tab routes to — mirrors the links in the Attention panel. */
export function tabHref(clientId: number, tab: string): string {
  return `/dashboard/clients/${clientId}?tab=${tab}`;
}

export type AffectedKeyword = {
  keyword: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
};

/** The keywords behind an ads quality-score rollup signal, worst spend first.
 *  Extracted from the Attention Needed panel so both views share one definition. */
export function affectedKeywordsForAdsSignal(
  adsSnapshot: AdsSnapshot | null,
  signalId: string,
): AffectedKeyword[] {
  const kq = adsSnapshot?.keyword_quality ?? [];
  let rows: typeof kq = [];
  if (signalId === "ads_qs_landing_page_rollup") {
    rows = kq.filter((r) => r.landing_page_experience === "BELOW_AVERAGE");
  } else if (signalId === "ads_qs_ad_relevance_rollup") {
    rows = kq.filter((r) => r.ad_relevance === "BELOW_AVERAGE");
  } else if (signalId === "ads_qs_expected_ctr_rollup") {
    rows = kq.filter((r) => r.expected_ctr === "BELOW_AVERAGE");
  } else if (signalId === "ads_qs_overall_low_rollup") {
    rows = kq.filter((r) => typeof r.quality_score === "number" && r.quality_score <= 5);
  }
  return rows
    .sort((a, b) => b.cost_micros - a.cost_micros)
    .slice(0, 8)
    .map((r) => ({
      keyword: r.keyword,
      match_type: r.match_type,
      campaign_name: r.campaign_name,
      ad_group_name: r.ad_group_name,
    }));
}
