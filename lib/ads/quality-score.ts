import type {
  AdsKeywordQualityRow,
  AdsQualityBucket,
  AdsSnapshotSignalDraft,
} from "@/lib/types/client";

export const ADS_KEYWORD_QUALITY_STORE_LIMIT = 150;
export const ADS_KEYWORD_QUALITY_MIN_IMPRESSIONS = 50;

export function normalizeQualityBucket(value: unknown): AdsQualityBucket {
  if (value == null || value === "UNSPECIFIED") return null;
  if (
    value === "BELOW_AVERAGE" ||
    value === "AVERAGE" ||
    value === "ABOVE_AVERAGE" ||
    value === "UNKNOWN"
  ) {
    return value;
  }
  return null;
}

export function formatQualityBucketLabel(value: AdsQualityBucket) {
  if (!value || value === "UNKNOWN") return "—";
  if (value === "BELOW_AVERAGE") return "Below average";
  if (value === "AVERAGE") return "Average";
  return "Above average";
}

export function formatCostMicros(costMicros: number) {
  return `$${(costMicros / 1_000_000).toFixed(2)}`;
}

export function isBelowAverage(value: AdsQualityBucket) {
  return value === "BELOW_AVERAGE";
}

export function hasQualityIssue(row: AdsKeywordQualityRow) {
  return (
    isBelowAverage(row.landing_page_experience) ||
    isBelowAverage(row.ad_relevance) ||
    isBelowAverage(row.expected_ctr) ||
    (typeof row.quality_score === "number" && row.quality_score <= 5)
  );
}

export function filterActionableKeywords(rows: AdsKeywordQualityRow[]) {
  const actionable = rows.filter(
    (row) =>
      row.impressions >= ADS_KEYWORD_QUALITY_MIN_IMPRESSIONS || row.cost_micros > 0,
  );
  return actionable
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, ADS_KEYWORD_QUALITY_STORE_LIMIT);
}

export type AdsQualitySummary = {
  totalKeywords: number;
  flaggedKeywords: number;
  landingPageBelowAverage: number;
  adRelevanceBelowAverage: number;
  expectedCtrBelowAverage: number;
  qualityScoreLow: number;
  landingPageSpendMicros: number;
  adRelevanceSpendMicros: number;
  expectedCtrSpendMicros: number;
};

export function summarizeQualityFlags(rows: AdsKeywordQualityRow[]): AdsQualitySummary {
  const summary: AdsQualitySummary = {
    totalKeywords: rows.length,
    flaggedKeywords: 0,
    landingPageBelowAverage: 0,
    adRelevanceBelowAverage: 0,
    expectedCtrBelowAverage: 0,
    qualityScoreLow: 0,
    landingPageSpendMicros: 0,
    adRelevanceSpendMicros: 0,
    expectedCtrSpendMicros: 0,
  };

  for (const row of rows) {
    const flagged = hasQualityIssue(row);
    if (flagged) summary.flaggedKeywords += 1;
    if (isBelowAverage(row.landing_page_experience)) {
      summary.landingPageBelowAverage += 1;
      summary.landingPageSpendMicros += row.cost_micros;
    }
    if (isBelowAverage(row.ad_relevance)) {
      summary.adRelevanceBelowAverage += 1;
      summary.adRelevanceSpendMicros += row.cost_micros;
    }
    if (isBelowAverage(row.expected_ctr)) {
      summary.expectedCtrBelowAverage += 1;
      summary.expectedCtrSpendMicros += row.cost_micros;
    }
    if (typeof row.quality_score === "number" && row.quality_score <= 5) {
      summary.qualityScoreLow += 1;
    }
  }

  return summary;
}

function keywordOccurrenceKey(row: AdsKeywordQualityRow) {
  return `${row.campaign_id}_${row.ad_group_id}_${row.criterion_id}`;
}

export function buildQualityScoreSignals(
  keywordQuality: AdsKeywordQualityRow[],
): AdsSnapshotSignalDraft[] {
  const signals: AdsSnapshotSignalDraft[] = [];
  const summary = summarizeQualityFlags(keywordQuality);

  if (summary.landingPageBelowAverage > 0) {
    signals.push({
      signal_id: "ads_qs_landing_page_rollup",
      severity: "critical",
      title: "Keywords with below-average landing page experience",
      description: `${summary.landingPageBelowAverage} Search keyword(s) have below-average landing page experience.`,
      suggestion:
        "Review destination pages for message match, load speed, and mobile usability on high-spend keywords.",
      metric_value: `${summary.landingPageBelowAverage} keywords • ${formatCostMicros(summary.landingPageSpendMicros)} spend (30d)`,
      occurrence_key: "ads_qs_landing_page_rollup",
    });
  }

  if (summary.adRelevanceBelowAverage > 0) {
    signals.push({
      signal_id: "ads_qs_ad_relevance_rollup",
      severity: summary.adRelevanceBelowAverage >= 5 ? "critical" : "watch",
      title: "Keywords with below-average ad relevance",
      description: `${summary.adRelevanceBelowAverage} Search keyword(s) have below-average ad relevance.`,
      suggestion:
        "Tighten ad groups, align headlines/descriptions to keyword intent, and split mixed themes.",
      metric_value: `${summary.adRelevanceBelowAverage} keywords • ${formatCostMicros(summary.adRelevanceSpendMicros)} spend (30d)`,
      occurrence_key: "ads_qs_ad_relevance_rollup",
    });
  }

  if (summary.expectedCtrBelowAverage > 0) {
    signals.push({
      signal_id: "ads_qs_expected_ctr_rollup",
      severity: "watch",
      title: "Keywords with below-average expected CTR",
      description: `${summary.expectedCtrBelowAverage} Search keyword(s) have below-average expected CTR.`,
      suggestion: "Test stronger ad copy, extensions, and more specific keyword/ad pairings.",
      metric_value: `${summary.expectedCtrBelowAverage} keywords • ${formatCostMicros(summary.expectedCtrSpendMicros)} spend (30d)`,
      occurrence_key: "ads_qs_expected_ctr_rollup",
    });
  }

  if (summary.qualityScoreLow > 0) {
    signals.push({
      signal_id: "ads_qs_overall_low_rollup",
      severity: "watch",
      title: "Keywords with low Quality Score",
      description: `${summary.qualityScoreLow} Search keyword(s) have Quality Score 5 or lower.`,
      suggestion:
        "Prioritize QS improvements on high-spend keywords across ad relevance, CTR, and landing pages.",
      metric_value: `${summary.qualityScoreLow} keywords at QS ≤ 5`,
      occurrence_key: "ads_qs_overall_low_rollup",
    });
  }

  const topBySpend = [...keywordQuality]
    .filter((row) => row.cost_micros > 0)
    .sort((left, right) => right.cost_micros - left.cost_micros);

  for (const row of topBySpend) {
    if (isBelowAverage(row.landing_page_experience)) {
      signals.push({
        signal_id: "ads_qs_landing_page_weak",
        severity: "critical",
        title: "Landing page experience below average",
        description: `"${row.keyword}" in ${row.ad_group_name} has below-average landing page experience.`,
        suggestion:
          "Improve page relevance, speed, and mobile experience for this keyword's destination URL.",
        metric_value: `${row.keyword} — LP below average — ${formatCostMicros(row.cost_micros)} spend (30d)`,
        occurrence_key: `ads_qs_lp_${keywordOccurrenceKey(row)}`,
      });
    }
    if (isBelowAverage(row.ad_relevance)) {
      signals.push({
        signal_id: "ads_qs_ad_relevance_weak",
        severity: row.cost_micros >= 500_000 ? "critical" : "watch",
        title: "Ad relevance below average",
        description: `"${row.keyword}" in ${row.ad_group_name} has below-average ad relevance.`,
        suggestion: "Rewrite ads to match search intent and split unrelated keywords into new ad groups.",
        metric_value: `${row.keyword} — ad relevance below average — ${formatCostMicros(row.cost_micros)} spend (30d)`,
        occurrence_key: `ads_qs_ar_${keywordOccurrenceKey(row)}`,
      });
    }
    if (isBelowAverage(row.expected_ctr)) {
      signals.push({
        signal_id: "ads_qs_expected_ctr_weak",
        severity: "watch",
        title: "Expected CTR below average",
        description: `"${row.keyword}" in ${row.ad_group_name} has below-average expected CTR.`,
        suggestion: "Test new headlines, descriptions, and callouts for this keyword.",
        metric_value: `${row.keyword} — expected CTR below average — ${formatCostMicros(row.cost_micros)} spend (30d)`,
        occurrence_key: `ads_qs_ctr_${keywordOccurrenceKey(row)}`,
      });
    }
    if (typeof row.quality_score === "number" && row.quality_score <= 5) {
      signals.push({
        signal_id: "ads_qs_overall_low",
        severity: "watch",
        title: "Low Quality Score keyword",
        description: `"${row.keyword}" in ${row.ad_group_name} has Quality Score ${row.quality_score}/10.`,
        suggestion:
          "Review ad relevance, expected CTR, and landing page experience for this keyword.",
        metric_value: `${row.keyword} — QS ${row.quality_score}/10 — ${formatCostMicros(row.cost_micros)} spend (30d)`,
        occurrence_key: `ads_qs_low_${keywordOccurrenceKey(row)}`,
      });
    }
  }

  return signals.slice(0, 40);
}
