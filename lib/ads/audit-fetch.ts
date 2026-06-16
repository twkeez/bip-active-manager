import type {
  AdsAuditConversionAction,
  AdsAuditDeviceRow,
  AdsAuditGeoRow,
  AdsAuditScheduleRow,
  AdsAuditSearchTermRow,
  AdsCampaignMetaRow,
} from "@/lib/types/client";
import type { SearchStreamContext } from "@/lib/ads/google-ads-stream";
import { searchStream } from "@/lib/ads/google-ads-stream";

export type AdsAuditSupplement = {
  searchTerms: AdsAuditSearchTermRow[];
  devices: AdsAuditDeviceRow[];
  geography: AdsAuditGeoRow[];
  schedule: AdsAuditScheduleRow[];
  campaigns: AdsCampaignMetaRow[];
  conversionActions: AdsAuditConversionAction[];
};

export async function fetchAdsAuditSupplement(
  ctx: SearchStreamContext,
  startDate: string,
  endDate: string,
): Promise<AdsAuditSupplement> {

  const searchTerms = await searchStream(ctx, buildSearchTermsQuery(startDate, endDate), (row) => {
    const term = row.searchTermView?.searchTerm?.trim();
    if (!term) return null;
    return {
      search_term: term,
      campaign_name: row.campaign?.name ?? "Unnamed campaign",
      ad_group_name: row.adGroup?.name ?? "Unnamed ad group",
      keyword_text: row.segments?.keyword?.info?.text ?? null,
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    };
  }).catch(() => [] as AdsAuditSearchTermRow[]);

  const devices = await searchStream(ctx, buildDeviceQuery(startDate, endDate), (row) => {
    const device = row.segments?.device;
    if (!device) return null;
    return {
      device,
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
      ctr: Number(row.metrics?.ctr ?? 0),
    };
  }).catch(() => [] as AdsAuditDeviceRow[]);

  const geography = await searchStream(ctx, buildGeoQuery(startDate, endDate), (row) => {
    const locationId = String(
      row.geographicView?.countryCriterionId ?? row.geographicView?.resourceName ?? "",
    );
    if (!locationId) return null;
    return {
      location_id: locationId,
      location_type: row.geographicView?.locationType ?? "UNKNOWN",
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
      ctr: Number(row.metrics?.ctr ?? 0),
    };
  }).catch(() => [] as AdsAuditGeoRow[]);

  const schedule = await searchStream(ctx, buildScheduleQuery(startDate, endDate), (row) => {
    const day = row.segments?.dayOfWeek;
    const hour = row.segments?.hour;
    if (!day || hour == null) return null;
    return {
      day_of_week: day,
      hour: Number(hour),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    };
  }).catch(() => [] as AdsAuditScheduleRow[]);

  const campaigns = await searchStream(
    ctx,
    buildCampaignMetaQuery(startDate, endDate),
    (row) => ({
      campaign_id: String(row.campaign?.id ?? ""),
      campaign_name: row.campaign?.name ?? "Unnamed campaign",
      advertising_channel_type: row.campaign?.advertisingChannelType ?? "UNKNOWN",
      bidding_strategy_type: row.campaign?.biddingStrategyType ?? "UNKNOWN",
      impressions: Number(row.metrics?.impressions ?? 0),
      cost_micros: Number(row.metrics?.costMicros ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    }),
  ).catch(() => [] as AdsCampaignMetaRow[]);

  const conversionActions = await searchStream(
    ctx,
    `SELECT conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.counting_type, conversion_action.status FROM conversion_action WHERE conversion_action.status = 'ENABLED' LIMIT 50`,
    (row) => ({
      name: row.conversionAction?.name ?? "Unnamed",
      type: row.conversionAction?.type ?? "UNKNOWN",
      category: row.conversionAction?.category ?? "UNKNOWN",
      counting_type: row.conversionAction?.countingType ?? "UNKNOWN",
      status: row.conversionAction?.status ?? "UNKNOWN",
    }),
  ).catch(() => [] as AdsAuditConversionAction[]);

  return {
    searchTerms: searchTerms.slice(0, 500),
    devices,
    geography: geography.slice(0, 200),
    schedule,
    campaigns,
    conversionActions,
  };
}

function buildSearchTermsQuery(startDate: string, endDate: string) {
  return `
    SELECT
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      segments.keyword.info.text,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 1000
  `;
}

function buildDeviceQuery(startDate: string, endDate: string) {
  return `
    SELECT
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
  `;
}

function buildGeoQuery(startDate: string, endDate: string) {
  return `
    SELECT
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM geographic_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `;
}

function buildScheduleQuery(startDate: string, endDate: string) {
  return `
    SELECT
      segments.day_of_week,
      segments.hour,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.clicks > 0
  `;
}

function buildCampaignMetaQuery(startDate: string, endDate: string) {
  return `
    SELECT
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;
}
