import { isBelowAverage } from "@/lib/ads/quality-score";
import type { AdsKeywordQualityRow } from "@/lib/types/client";

export const BUDGET_LOST_IS_THRESHOLD_PCT = 10;

export type SmartPlaybookAdRelevanceTask = {
  kind: "ad_relevance";
  keywords: string[];
};

export type SmartPlaybookExpectedCtrTask = {
  kind: "expected_ctr";
  keywords: string[];
  adGroupNames: string[];
};

export type SmartPlaybookBudgetTask = {
  kind: "budget";
  lostImpressionSharePct: number;
  averageCpc: number | null;
};

export type SmartPlaybookTask =
  | SmartPlaybookAdRelevanceTask
  | SmartPlaybookExpectedCtrTask
  | SmartPlaybookBudgetTask;

function uniqueKeywords(rows: AdsKeywordQualityRow[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const sorted = [...rows].sort((left, right) => right.cost_micros - left.cost_micros);

  for (const row of sorted) {
    const keyword = row.keyword.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }

  return result;
}

export function buildSmartAdsPlaybook(input: {
  keywordQuality?: AdsKeywordQualityRow[];
  searchBudgetLostImpressionShare?: number | null;
  averageCpc?: number | null;
}): SmartPlaybookTask[] {
  const rows = input.keywordQuality ?? [];
  const tasks: SmartPlaybookTask[] = [];

  const adRelevanceKeywords = uniqueKeywords(
    rows.filter((row) => isBelowAverage(row.ad_relevance)),
  );
  if (adRelevanceKeywords.length > 0) {
    tasks.push({ kind: "ad_relevance", keywords: adRelevanceKeywords });
  }

  const expectedCtrRows = rows.filter((row) => isBelowAverage(row.expected_ctr));
  const expectedCtrKeywords = uniqueKeywords(expectedCtrRows);
  if (expectedCtrKeywords.length > 0) {
    tasks.push({
      kind: "expected_ctr",
      keywords: expectedCtrKeywords,
      adGroupNames: [...new Set(expectedCtrRows.map((row) => row.ad_group_name))],
    });
  }

  const lostIs = input.searchBudgetLostImpressionShare;
  if (typeof lostIs === "number" && lostIs * 100 > BUDGET_LOST_IS_THRESHOLD_PCT) {
    tasks.push({
      kind: "budget",
      lostImpressionSharePct: lostIs * 100,
      averageCpc: input.averageCpc ?? null,
    });
  }

  return tasks;
}

export function formatKeywordListForCopy(keywords: string[], max = 6): string {
  if (keywords.length === 0) return "";
  const shown = keywords.slice(0, max);
  const overflow = keywords.length - shown.length;
  const quoted = shown.map((keyword) => `"${keyword}"`);
  const base =
    quoted.length === 1
      ? quoted[0]
      : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
  return overflow > 0 ? `${base} (+${overflow} more)` : base;
}

export function describeAdGroups(adGroupNames: string[], max = 2): string {
  if (adGroupNames.length === 0) return "your active ad groups";
  const shown = adGroupNames.slice(0, max);
  const overflow = adGroupNames.length - shown.length;
  const base = shown.join(", ");
  return overflow > 0 ? `${base} (+${overflow} more ad groups)` : base;
}
