import {
  filterActionableKeywords,
  normalizeQualityBucket,
} from "@/lib/ads/quality-score";
import {
  createSearchStreamContext,
  searchStream,
} from "@/lib/ads/google-ads-stream";
import type { AdsCallRow, AdsKeywordQualityRow } from "@/lib/types/client";
import type { SearchStreamContext } from "@/lib/ads/google-ads-stream";

export type AdsCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  interactions: number;
  cost_micros: number;
  conversions: number;
  all_conversions: number;
  view_through_conversions: number;
  conversions_value: number;
  phone_calls?: number;
  phone_impressions?: number;
  ctr: number;
  search_impression_share: number | null;
  search_rank_lost_impression_share: number | null;
  search_budget_lost_impression_share: number | null;
  search_top_impression_share: number | null;
  search_absolute_top_impression_share: number | null;
};

export type AdsAuctionInsightRow = {
  campaign_id: string;
  campaign_name: string;
  domain: string;
  impression_share: number | null;
  overlap_rate: number | null;
  position_above_rate: number | null;
  top_of_page_rate: number | null;
  outranking_share: number | null;
};

export type AdsTotals = {
  impressions: number;
  clicks: number;
  interactions: number;
  cost_micros: number;
  conversions: number;
  all_conversions: number;
  view_through_conversions: number;
  conversions_value: number;
  phone_calls?: number;
  phone_impressions?: number;
  ctr: number;
  average_cpc: number;
  conversion_rate: number | null;
  cost_per_conversion: number | null;
  roas: number | null;
  search_impression_share: number | null;
  search_rank_lost_impression_share: number | null;
  search_budget_lost_impression_share: number | null;
  search_top_impression_share: number | null;
  search_absolute_top_impression_share: number | null;
};

export type AdsSyncResult = {
  customerId: string;
  startDate: string;
  endDate: string;
  totals: AdsTotals;
  campaigns: AdsCampaignRow[];
  auctionInsights: AdsAuctionInsightRow[];
  keywordQuality: AdsKeywordQualityRow[];
  calls: AdsCallRow[];
};

// Per-call detail from the call_view resource. Only accounts with call assets /
// call-only ads using Google forwarding numbers return rows; Google retains the
// detailed data for a limited window. Best-effort — the caller wraps it so a
// failure (call reporting off, resource unavailable) yields no calls, not a
// failed sync.
async function fetchCallDetails(
  ctx: SearchStreamContext,
  startDate: string,
  endDate: string,
): Promise<AdsCallRow[]> {
  const query = `
    SELECT
      call_view.resource_name,
      call_view.caller_country_code,
      call_view.caller_area_code,
      call_view.call_duration_seconds,
      call_view.start_call_date_time,
      call_view.end_call_date_time,
      call_view.call_status,
      call_view.type,
      call_view.call_tracking_display_location,
      campaign.name,
      segments.date
    FROM call_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date DESC
    LIMIT 500
  `;
  return searchStream(ctx, query, (row) => {
    const cv = row.callView;
    if (!cv) return null;
    return {
      resource_name: cv.resourceName ?? "",
      campaign_name: row.campaign?.name ?? "Unnamed campaign",
      start_time: cv.startCallDateTime ?? null,
      end_time: cv.endCallDateTime ?? null,
      duration_seconds: Number(cv.callDurationSeconds ?? 0),
      status: cv.callStatus ?? "UNKNOWN",
      call_type: cv.type ?? "UNKNOWN",
      caller_area_code: cv.callerAreaCode ?? null,
      caller_country_code: cv.callerCountryCode ?? null,
      display_location: cv.callTrackingDisplayLocation ?? "UNKNOWN",
    };
  });
}

async function fetchKeywordQuality(
  ctx: SearchStreamContext,
  startDate: string,
  endDate: string,
): Promise<AdsKeywordQualityRow[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.status = 'ENABLED'
      AND ad_group_criterion.negative = FALSE
      AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `;

  const rows = await searchStream(ctx, query, (row) => {
    const keyword = row.adGroupCriterion?.keyword?.text?.trim();
    if (!keyword) return null;
    const qualityInfo = row.adGroupCriterion?.qualityInfo;
    const qualityScore =
      typeof qualityInfo?.qualityScore === "number" ? qualityInfo.qualityScore : null;
    return {
      campaign_id: String(row.campaign?.id ?? ""),
      campaign_name: row.campaign?.name ?? "Unnamed campaign",
      ad_group_id: String(row.adGroup?.id ?? ""),
      ad_group_name: row.adGroup?.name ?? "Unnamed ad group",
      criterion_id: String(row.adGroupCriterion?.criterionId ?? ""),
      keyword,
      match_type: row.adGroupCriterion?.keyword?.matchType ?? "UNKNOWN",
      quality_score: qualityScore,
      ad_relevance: normalizeQualityBucket(qualityInfo?.creativeQualityScore),
      landing_page_experience: normalizeQualityBucket(qualityInfo?.postClickQualityScore),
      expected_ctr: normalizeQualityBucket(qualityInfo?.searchPredictedCtr),
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    };
  });

  return filterActionableKeywords(rows);
}

export async function runGoogleAdsSync(
  rawCustomerId: string,
  startDate: string,
  endDate: string,
): Promise<AdsSyncResult> {
  const { customerId, apiVersion, ctx } = await createSearchStreamContext(rawCustomerId);

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.interactions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.view_through_conversions,
      metrics.conversions_value,
      metrics.phone_calls,
      metrics.phone_impressions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_top_impression_share,
      metrics.search_absolute_top_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `;

  let campaigns: AdsCampaignRow[];
  try {
    campaigns = await searchStream(ctx, query, (row) => {
      return {
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: row.campaign?.name ?? "Unnamed campaign",
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        interactions: Number(row.metrics?.interactions ?? 0),
        cost_micros: Number(row.metrics?.costMicros ?? 0),
        conversions: Number(row.metrics?.conversions ?? 0),
        all_conversions: Number(row.metrics?.allConversions ?? 0),
        view_through_conversions: Number(row.metrics?.viewThroughConversions ?? 0),
        conversions_value: Number(row.metrics?.conversionsValue ?? 0),
        phone_calls: Number(row.metrics?.phoneCalls ?? 0),
        phone_impressions: Number(row.metrics?.phoneImpressions ?? 0),
        ctr: Number(row.metrics?.ctr ?? 0),
        search_impression_share:
          typeof row.metrics?.searchImpressionShare === "number"
            ? row.metrics.searchImpressionShare : null,
        search_rank_lost_impression_share:
          typeof row.metrics?.searchRankLostImpressionShare === "number"
            ? row.metrics.searchRankLostImpressionShare : null,
        search_budget_lost_impression_share:
          typeof row.metrics?.searchBudgetLostImpressionShare === "number"
            ? row.metrics.searchBudgetLostImpressionShare : null,
        search_top_impression_share:
          typeof row.metrics?.searchTopImpressionShare === "number"
            ? row.metrics.searchTopImpressionShare : null,
        search_absolute_top_impression_share:
          typeof row.metrics?.searchAbsoluteTopImpressionShare === "number"
            ? row.metrics.searchAbsoluteTopImpressionShare : null,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Ads sync failed";
    if (message.includes("404")) {
      throw new Error(
        `Google Ads API failed (404) for customer ${customerId} on ${apiVersion}. This can mean the API version is wrong, the account ID is not linked under your login customer, or your developer token is not approved for that account.`,
      );
    }
    throw error;
  }

  const rawTotals = campaigns.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.interactions += row.interactions;
      acc.cost_micros += row.cost_micros;
      acc.conversions += row.conversions;
      acc.all_conversions += row.all_conversions;
      acc.view_through_conversions += row.view_through_conversions;
      acc.conversions_value += row.conversions_value;
      acc.phone_calls += row.phone_calls ?? 0;
      acc.phone_impressions += row.phone_impressions ?? 0;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      interactions: 0,
      cost_micros: 0,
      conversions: 0,
      all_conversions: 0,
      view_through_conversions: 0,
      conversions_value: 0,
      phone_calls: 0,
      phone_impressions: 0,
    },
  );

  const weightedDenominator = campaigns.reduce(
    (sum, row) => sum + Math.max(1, row.impressions), 0,
  );

  function weightedShare(field: keyof Pick<AdsCampaignRow,
    "search_impression_share" | "search_rank_lost_impression_share" |
    "search_budget_lost_impression_share" | "search_top_impression_share" |
    "search_absolute_top_impression_share"
  >): number | null {
    const numerator = campaigns.reduce((sum, row) => {
      const v = row[field];
      return v == null ? sum : sum + v * Math.max(1, row.impressions);
    }, 0);
    return weightedDenominator > 0 ? numerator / weightedDenominator : null;
  }

  const spendUsd = rawTotals.cost_micros / 1_000_000;
  const totals: AdsTotals = {
    ...rawTotals,
    ctr: rawTotals.impressions > 0 ? rawTotals.clicks / rawTotals.impressions : 0,
    average_cpc: rawTotals.clicks > 0 ? rawTotals.cost_micros / rawTotals.clicks : 0,
    conversion_rate: rawTotals.clicks > 0 ? rawTotals.conversions / rawTotals.clicks : null,
    cost_per_conversion: rawTotals.conversions > 0 ? spendUsd / rawTotals.conversions : null,
    roas: spendUsd > 0 && rawTotals.conversions_value > 0
      ? rawTotals.conversions_value / spendUsd : null,
    search_impression_share: weightedShare("search_impression_share"),
    search_rank_lost_impression_share: weightedShare("search_rank_lost_impression_share"),
    search_budget_lost_impression_share: weightedShare("search_budget_lost_impression_share"),
    search_top_impression_share: weightedShare("search_top_impression_share"),
    search_absolute_top_impression_share: weightedShare("search_absolute_top_impression_share"),
  };

  const auctionInsights: AdsAuctionInsightRow[] = [];
  try {
    const auctionQuery = `
      SELECT
        campaign.id,
        campaign.name,
        segments.auction_insight_domain,
        metrics.auction_insight_search_impression_share,
        metrics.auction_insight_search_overlap_rate,
        metrics.auction_insight_search_position_above_rate,
        metrics.auction_insight_search_top_of_page_rate,
        metrics.auction_insight_search_outranking_share
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.auction_insight_search_impression_share DESC
      LIMIT 100
    `;
    auctionInsights.push(
      ...(await searchStream(ctx, auctionQuery, (row) => {
        const domain = row.segments?.auctionInsightDomain?.trim();
        if (!domain) return null;
        return {
          campaign_id: String(row.campaign?.id ?? ""),
          campaign_name: row.campaign?.name ?? "Unnamed campaign",
          domain,
          impression_share:
            typeof row.metrics?.auctionInsightSearchImpressionShare === "number"
              ? row.metrics.auctionInsightSearchImpressionShare
              : null,
          overlap_rate:
            typeof row.metrics?.auctionInsightSearchOverlapRate === "number"
              ? row.metrics.auctionInsightSearchOverlapRate
              : null,
          position_above_rate:
            typeof row.metrics?.auctionInsightSearchPositionAboveRate === "number"
              ? row.metrics.auctionInsightSearchPositionAboveRate
              : null,
          top_of_page_rate:
            typeof row.metrics?.auctionInsightSearchTopOfPageRate === "number"
              ? row.metrics.auctionInsightSearchTopOfPageRate
              : null,
          outranking_share:
            typeof row.metrics?.auctionInsightSearchOutrankingShare === "number"
              ? row.metrics.auctionInsightSearchOutrankingShare
              : null,
        };
      })),
    );
  } catch {
    // Optional
  }

  let keywordQuality: AdsKeywordQualityRow[] = [];
  try {
    keywordQuality = await fetchKeywordQuality(ctx, startDate, endDate);
  } catch {
    // Optional
  }

  let calls: AdsCallRow[] = [];
  try {
    calls = await fetchCallDetails(ctx, startDate, endDate);
  } catch {
    // Optional — call reporting may be off for this account.
  }

  return {
    customerId,
    startDate,
    endDate,
    totals,
    campaigns,
    auctionInsights,
    keywordQuality,
    calls,
  };
}

export { createSearchStreamContext };
