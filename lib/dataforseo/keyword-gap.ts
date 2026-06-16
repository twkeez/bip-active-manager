import {
  cleanDomain,
  dataForSeoBasicAuthHeader,
  dataForSeoTaskError,
  extractTaskResultItems,
} from "@/lib/dataforseo/client";
import type { KeywordGapRow, KeywordGapType } from "@/lib/dataforseo/types";

export {
  cleanDomain,
  dataForSeoBasicAuthHeader,
  dataForSeoTaskError,
  extractTaskResultItems as extractKeywordIntersectionItems,
} from "@/lib/dataforseo/client";

export type { KeywordGapRow, KeywordGapType } from "@/lib/dataforseo/types";

/** @deprecated Use DATAFORSEO_ENDPOINTS.domainIntersection */
export const DATAFORSEO_DOMAIN_INTERSECTION_URL =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live";

/** @deprecated Use DATAFORSEO_DOMAIN_INTERSECTION_URL */
export const DATAFORSEO_KEYWORD_INTERSECTION_URL = DATAFORSEO_DOMAIN_INTERSECTION_URL;

/** @deprecated Use cleanDomain */
export const normalizeGapDomain = cleanDomain;

type SerpElement = {
  rank_absolute?: number | null;
};

type RawKeywordGapItem = {
  keyword?: string;
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number | null;
    };
    keyword_properties?: {
      search_volume?: number | null;
      keyword_difficulty?: number | null;
    };
    serp_info?: {
      keyword_difficulty?: number | null;
    };
  };
  first_domain_serp_element?: SerpElement | null;
  second_domain_serp_element?: SerpElement | null;
};

function readSearchVolume(item: RawKeywordGapItem): number {
  return (
    item.keyword_data?.keyword_info?.search_volume ??
    item.keyword_data?.keyword_properties?.search_volume ??
    0
  );
}

function readKeywordDifficulty(item: RawKeywordGapItem): number {
  return (
    item.keyword_data?.serp_info?.keyword_difficulty ??
    item.keyword_data?.keyword_properties?.keyword_difficulty ??
    0
  );
}

function readKeyword(item: RawKeywordGapItem): string {
  return item.keyword ?? item.keyword_data?.keyword ?? "";
}

export function formatKeywordGapItems(
  items: unknown[],
  _clientDomain: string,
  _competitorDomain: string,
): KeywordGapRow[] {
  return items.map((raw, idx) => {
    const item = raw as RawKeywordGapItem;
    const clientMetrics = item.first_domain_serp_element ?? null;
    const compMetrics = item.second_domain_serp_element ?? null;

    let type: KeywordGapType = "shared";
    if (!clientMetrics || clientMetrics.rank_absolute == null) {
      type = "missing";
    } else if (
      compMetrics?.rank_absolute != null &&
      clientMetrics.rank_absolute > compMetrics.rank_absolute
    ) {
      type = "weak";
    }

    const difficultyValue = readKeywordDifficulty(item);

    return {
      id: idx,
      keyword: readKeyword(item),
      volume: readSearchVolume(item),
      difficulty: `${difficultyValue}%`,
      clientRank: clientMetrics?.rank_absolute ?? "-",
      compRank: compMetrics?.rank_absolute ?? "-",
      type,
    };
  });
}
