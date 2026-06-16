import {
  filterActionableKeywords,
  normalizeQualityBucket,
} from "@/lib/ads/quality-score";
import {
  createSearchStreamContext,
  searchStream,
} from "@/lib/ads/google-ads-stream";
import type { AdsKeywordQualityRow } from "@/lib/types/client";
import type { SearchStreamContext } from "@/lib/ads/google-ads-stream";

export type AdsCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  ctr: number;
  search_impression_share: number | null;
  search_rank_lost_impression_share: number | null;
  search_budget_lost_impression_share: number | null;
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

export type AdsSyncResult = {
  customerId: string;
  startDate: string;
  endDate: string;
  totals: {
    impressions: number;
    clicks: number;
    cost_micros: number;
    conversions: number;
    ctr: number;
    average_cpc: number;
    search_impression_share: number | null;
    search_rank_lost_impression_share: number | null;
    search_budget_lost_impression_share: number | null;
  };
  campaigns: AdsCampaignRow[];
  auctionInsights: AdsAuctionInsightRow[];
  keywordQuality: AdsKeywordQualityRow[];
};

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
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `;

  let campaigns: AdsCampaignRow[];
  try {
    campaigns = await searchStream(ctx, query, (row) => {
      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const costMicros = Number(row.metrics?.costMicros ?? 0);
      const conversions = Number(row.metrics?.conversions ?? 0);
      const ctr = Number(row.metrics?.ctr ?? 0);
      return {
        campaign_id: String(row.campaign?.id ?? ""),
        campaign_name: row.campaign?.name ?? "Unnamed campaign",
        impressions,
        clicks,
        cost_micros: costMicros,
        conversions,
        ctr,
        search_impression_share:
          typeof row.metrics?.searchImpressionShare === "number"
            ? row.metrics.searchImpressionShare
            : null,
        search_rank_lost_impression_share:
          typeof row.metrics?.searchRankLostImpressionShare === "number"
            ? row.metrics.searchRankLostImpressionShare
            : null,
        search_budget_lost_impression_share:
          typeof row.metrics?.searchBudgetLostImpressionShare === "number"
            ? row.metrics.searchBudgetLostImpressionShare
            : null,
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

  const totals = campaigns.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.cost_micros += row.cost_micros;
      acc.conversions += row.conversions;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      cost_micros: 0,
      conversions: 0,
      ctr: 0,
      average_cpc: 0,
      search_impression_share: null as number | null,
      search_rank_lost_impression_share: null as number | null,
      search_budget_lost_impression_share: null as number | null,
    },
  );
  totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  totals.average_cpc = totals.clicks > 0 ? totals.cost_micros / totals.clicks : 0;
  const weightedImpressionShareNumerator = campaigns.reduce((sum, row) => {
    if (row.search_impression_share == null) return sum;
    return sum + row.search_impression_share * Math.max(1, row.impressions);
  }, 0);
  const weightedRankLostNumerator = campaigns.reduce((sum, row) => {
    if (row.search_rank_lost_impression_share == null) return sum;
    return sum + row.search_rank_lost_impression_share * Math.max(1, row.impressions);
  }, 0);
  const weightedBudgetLostNumerator = campaigns.reduce((sum, row) => {
    if (row.search_budget_lost_impression_share == null) return sum;
    return sum + row.search_budget_lost_impression_share * Math.max(1, row.impressions);
  }, 0);
  const weightedDenominator = campaigns.reduce(
    (sum, row) => sum + Math.max(1, row.impressions),
    0,
  );
  totals.search_impression_share =
    weightedDenominator > 0 ? weightedImpressionShareNumerator / weightedDenominator : null;
  totals.search_rank_lost_impression_share =
    weightedDenominator > 0 ? weightedRankLostNumerator / weightedDenominator : null;
  totals.search_budget_lost_impression_share =
    weightedDenominator > 0 ? weightedBudgetLostNumerator / weightedDenominator : null;

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

  return {
    customerId,
    startDate,
    endDate,
    totals,
    campaigns,
    auctionInsights,
    keywordQuality,
  };
}

export { createSearchStreamContext };
