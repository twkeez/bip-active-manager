import { createSearchStreamContext, searchStream } from "@/lib/ads/google-ads-stream";

// Raw diagnostic pull for one Google Ads account. Percentages are stored as
// 0–100 numbers; money as dollars (cost_micros / 1e6). Each query is isolated
// so one unsupported field/segment can't sink the whole diagnosis.

export type DiagCampaign = {
  name: string;
  channel: string;
  bidStrategy: string;
  budget: number;
  cost: number;
  impr: number;
  clicks: number;
  ctr: number | null;
  conv: number;
  convVal: number;
  IS: number | null;
  absTopIS: number | null;
  topIS: number | null;
  lostBudget: number | null;
  lostRank: number | null;
};

export type DiagSearchTerm = { term: string; impr: number; clicks: number; cost: number; conv: number };
export type DiagKeyword = { kw: string; match: string; qs: number | null; cost: number; clicks: number; conv: number; absTopIS: number | null };
export type DiagAuction = { domain: string; IS: number | null; outranking: number | null; overlap: number | null; posAbove: number | null; topOfPage: number | null };
export type DiagDevice = { device: string; cost: number; clicks: number; conv: number };
export type DiagConvAction = { name: string; type: string; category: string; status: string; counting: string };

export type AccountDiagnosticRaw = {
  customerId: string;
  window: { start: string; end: string };
  conversionActions: DiagConvAction[];
  campaigns: DiagCampaign[];
  prev: { cost: number; clicks: number; conv: number };
  auction: DiagAuction[];
  searchTerms: DiagSearchTerm[];
  keywords: DiagKeyword[];
  device: DiagDevice[];
};

const dollars = (micros: number) => Math.round((micros / 1e6) * 100) / 100;
const pct = (v: unknown): number | null => (typeof v === "number" ? Math.round(v * 1000) / 10 : null);
const num = (v: unknown) => Number(v ?? 0);

function isoDaysAgo(n: number): string {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - n);
  return x.toISOString().slice(0, 10);
}

export async function fetchAccountDiagnostic(rawCustomerId: string): Promise<AccountDiagnosticRaw> {
  const end = isoDaysAgo(1);
  const start = isoDaysAgo(30);
  const prevEnd = isoDaysAgo(31);
  const prevStart = isoDaysAgo(60);
  const { customerId, ctx } = await createSearchStreamContext(rawCustomerId);

  async function q<T>(query: string, map: (r: Record<string, any>) => T | null): Promise<T[]> {
    try {
      return await searchStream(ctx, query, map as never);
    } catch {
      return [];
    }
  }

  const conversionActions = await q<DiagConvAction>(
    `SELECT conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.status, conversion_action.counting_type FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
    (r) => ({
      name: r.conversionAction?.name ?? "",
      type: r.conversionAction?.type ?? "",
      category: r.conversionAction?.category ?? "",
      status: r.conversionAction?.status ?? "",
      counting: r.conversionAction?.countingType ?? "",
    }),
  );

  const campaigns = await q<DiagCampaign>(
    `SELECT campaign.name, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign_budget.amount_micros,
       metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions, metrics.conversions_value,
       metrics.search_impression_share, metrics.search_absolute_top_impression_share, metrics.search_top_impression_share,
       metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
     FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}' AND campaign.status = 'ENABLED'
     ORDER BY metrics.cost_micros DESC`,
    (r) => ({
      name: r.campaign?.name ?? "Unnamed",
      channel: r.campaign?.advertisingChannelType ?? "",
      bidStrategy: r.campaign?.biddingStrategyType ?? "",
      budget: dollars(num(r.campaignBudget?.amountMicros)),
      cost: dollars(num(r.metrics?.costMicros)),
      impr: num(r.metrics?.impressions),
      clicks: num(r.metrics?.clicks),
      ctr: pct(r.metrics?.ctr),
      conv: Math.round(num(r.metrics?.conversions) * 10) / 10,
      convVal: Math.round(num(r.metrics?.conversionsValue)),
      IS: pct(r.metrics?.searchImpressionShare),
      absTopIS: pct(r.metrics?.searchAbsoluteTopImpressionShare),
      topIS: pct(r.metrics?.searchTopImpressionShare),
      lostBudget: pct(r.metrics?.searchBudgetLostImpressionShare),
      lostRank: pct(r.metrics?.searchRankLostImpressionShare),
    }),
  );

  const prevRows = await q<{ cost: number; clicks: number; conv: number }>(
    `SELECT metrics.cost_micros, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${prevStart}' AND '${prevEnd}' AND campaign.status='ENABLED'`,
    (r) => ({ cost: num(r.metrics?.costMicros), clicks: num(r.metrics?.clicks), conv: num(r.metrics?.conversions) }),
  );
  const prev = prevRows.reduce(
    (a, r) => ({ cost: a.cost + r.cost, clicks: a.clicks + r.clicks, conv: a.conv + r.conv }),
    { cost: 0, clicks: 0, conv: 0 },
  );
  prev.cost = dollars(prev.cost);
  prev.conv = Math.round(prev.conv * 10) / 10;

  const auction = await q<DiagAuction>(
    `SELECT segments.auction_insight_domain, metrics.auction_insight_search_impression_share, metrics.auction_insight_search_outranking_share, metrics.auction_insight_search_overlap_rate, metrics.auction_insight_search_position_above_rate, metrics.auction_insight_search_top_of_page_rate
     FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}' ORDER BY metrics.auction_insight_search_impression_share DESC LIMIT 40`,
    (r) => {
      const domain = r.segments?.auctionInsightDomain?.trim();
      if (!domain) return null;
      return {
        domain,
        IS: pct(r.metrics?.auctionInsightSearchImpressionShare),
        outranking: pct(r.metrics?.auctionInsightSearchOutrankingShare),
        overlap: pct(r.metrics?.auctionInsightSearchOverlapRate),
        posAbove: pct(r.metrics?.auctionInsightSearchPositionAboveRate),
        topOfPage: pct(r.metrics?.auctionInsightSearchTopOfPageRate),
      };
    },
  );

  const searchTerms = await q<DiagSearchTerm>(
    `SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND metrics.cost_micros > 0 ORDER BY metrics.cost_micros DESC LIMIT 250`,
    (r) => ({
      term: r.searchTermView?.searchTerm ?? "",
      impr: num(r.metrics?.impressions),
      clicks: num(r.metrics?.clicks),
      cost: dollars(num(r.metrics?.costMicros)),
      conv: Math.round(num(r.metrics?.conversions) * 10) / 10,
    }),
  );

  const keywords = await q<DiagKeyword>(
    `SELECT campaign.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.search_absolute_top_impression_share FROM keyword_view WHERE segments.date BETWEEN '${start}' AND '${end}' AND ad_group_criterion.status='ENABLED' AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 200`,
    (r) => ({
      kw: r.adGroupCriterion?.keyword?.text ?? "",
      match: r.adGroupCriterion?.keyword?.matchType ?? "",
      qs: typeof r.adGroupCriterion?.qualityInfo?.qualityScore === "number" ? r.adGroupCriterion.qualityInfo.qualityScore : null,
      cost: dollars(num(r.metrics?.costMicros)),
      clicks: num(r.metrics?.clicks),
      conv: Math.round(num(r.metrics?.conversions) * 10) / 10,
      absTopIS: pct(r.metrics?.searchAbsoluteTopImpressionShare),
    }),
  );

  const device = await q<DiagDevice>(
    `SELECT segments.device, metrics.cost_micros, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}'`,
    (r) => ({
      device: r.segments?.device ?? "UNKNOWN",
      cost: dollars(num(r.metrics?.costMicros)),
      clicks: num(r.metrics?.clicks),
      conv: Math.round(num(r.metrics?.conversions) * 10) / 10,
    }),
  );
  // device query returns a row per (campaign×device); collapse to device totals.
  const deviceTotals = new Map<string, DiagDevice>();
  for (const d of device) {
    const cur = deviceTotals.get(d.device) ?? { device: d.device, cost: 0, clicks: 0, conv: 0 };
    cur.cost = Math.round((cur.cost + d.cost) * 100) / 100;
    cur.clicks += d.clicks;
    cur.conv = Math.round((cur.conv + d.conv) * 10) / 10;
    deviceTotals.set(d.device, cur);
  }

  return {
    customerId,
    window: { start, end },
    conversionActions,
    campaigns,
    prev,
    auction,
    searchTerms,
    keywords,
    device: [...deviceTotals.values()].sort((a, b) => b.cost - a.cost),
  };
}
