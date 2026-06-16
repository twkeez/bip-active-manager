import type { ClientKeywordTarget, KeywordHealthRow } from "@/lib/types/client";

export type RankFluctuation = {
  keyword: string;
  pageUrl: string | null;
  previousPosition: number | null;
  currentPosition: number | null;
  delta: number;
  isTracked: boolean;
};

export function buildRankFluctuations(
  keywordHealthRows: KeywordHealthRow[],
  keywordTargets: Pick<ClientKeywordTarget, "keyword" | "is_active">[],
  threshold = 5,
): RankFluctuation[] {
  const tracked = new Set(
    keywordTargets
      .filter((row) => row.is_active)
      .map((row) => row.keyword.trim().toLowerCase())
      .filter(Boolean),
  );

  return keywordHealthRows
    .filter((row) => Math.abs(row.position_delta) >= threshold)
    .map((row) => ({
      keyword: row.keyword,
      pageUrl: row.page_url,
      previousPosition: row.previous_position,
      currentPosition: row.current_position,
      delta: row.position_delta,
      isTracked: tracked.has(row.keyword.trim().toLowerCase()),
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

export function countSignificantFluctuations(
  keywordHealthRows: KeywordHealthRow[],
  keywordTargets: Pick<ClientKeywordTarget, "keyword" | "is_active">[],
  threshold = 5,
) {
  const fluctuations = buildRankFluctuations(keywordHealthRows, keywordTargets, threshold);
  const tracked = fluctuations.filter((row) => row.isTracked);
  return {
    total: fluctuations.length,
    tracked: tracked.length,
    rows: fluctuations,
  };
}
