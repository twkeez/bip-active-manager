import type { GscQueryMetric } from "@/lib/types/client";

export type Page2Opportunity = {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  suggestedAction: string;
};

export type Page2OpportunitiesOptions = {
  minImpressions?: number;
  minPosition?: number;
  maxPosition?: number;
  limit?: number;
};

export function buildPage2Opportunities(
  queryMetrics: Pick<GscQueryMetric, "query" | "impressions" | "clicks" | "position">[],
  options: Page2OpportunitiesOptions = {},
): Page2Opportunity[] {
  const {
    minImpressions = 50,
    minPosition = 11,
    maxPosition = 20,
    limit = 25,
  } = options;

  return queryMetrics
    .filter(
      (row) =>
        row.impressions >= minImpressions &&
        row.position >= minPosition &&
        row.position <= maxPosition &&
        row.query.trim().length > 0,
    )
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, limit)
    .map((row) => ({
      query: row.query.trim(),
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      suggestedAction:
        "Refresh the ranking page or create targeted content to push this query onto page 1.",
    }));
}
