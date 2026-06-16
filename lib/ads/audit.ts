import { formatCostMicros, summarizeQualityFlags } from "@/lib/ads/quality-score";
import type { AdsAuditSupplement } from "@/lib/ads/audit-fetch";
import type { AdsSyncResult } from "@/lib/ads/google-ads";
import type {
  AdsAuditKeywordRow,
  AdsAuditPriority,
  AdsAuditReport,
  AdsAuditScheduleRow,
  AdsAuditSearchTermRow,
  AdsKeywordQualityRow,
} from "@/lib/types/client";

const DRIFT_PATTERNS = [
  /\bhow to\b/i,
  /\bsymptom/i,
  /\bjobs?\b/i,
  /\bcareer/i,
  /\bsalary\b/i,
  /\bschool\b/i,
  /\badoption\b/i,
  /\brescue\b/i,
  /\bhumane society\b/i,
  /\baspca\b/i,
  /\banimal control\b/i,
  /\bbrushing\b/i,
  /\bpoison/i,
  /\bfree\b/i,
  /\bdiy\b/i,
];

const NEGATIVE_CANDIDATE_PATTERNS = [
  "free",
  "cheap",
  "jobs",
  "salary",
  "school",
  "training",
  "diy",
  "adoption",
  "humane society",
  "aspca",
  "animal control",
  "reviews",
  "grooming",
  "supplies",
  "food",
];

function microsToCpa(costMicros: number, conversions: number) {
  if (conversions <= 0) return null;
  return costMicros / conversions;
}

function computeConversionRate(clicks: number, conversions: number) {
  if (clicks <= 0) return null;
  return conversions / clicks;
}

function toAuditKeyword(row: AdsKeywordQualityRow, accountCpa: number | null): AdsAuditKeywordRow {
  const cpa = microsToCpa(row.cost_micros, row.conversions);
  const cvr = computeConversionRate(row.clicks, row.conversions);
  const notes: string[] = [];
  if (row.quality_score != null && row.quality_score <= 5) {
    notes.push(`QS ${row.quality_score}/10`);
  }
  if (row.landing_page_experience === "BELOW_AVERAGE") notes.push("LP below average");
  if (row.ad_relevance === "BELOW_AVERAGE") notes.push("Ad relevance below average");
  if (cpa != null && accountCpa != null && cpa > accountCpa * 1.5) {
    notes.push(`CPA ${formatCostMicros(cpa)} vs account ${formatCostMicros(accountCpa)}`);
  }
  return {
    keyword: row.keyword,
    match_type: row.match_type,
    campaign_name: row.campaign_name,
    ad_group_name: row.ad_group_name,
    impressions: row.impressions,
    clicks: row.clicks,
    cost_micros: row.cost_micros,
    conversions: row.conversions,
    ctr: row.clicks > 0 ? row.clicks / Math.max(1, row.impressions) : 0,
    conversion_rate: cvr,
    cpa_micros: cpa,
    quality_score: row.quality_score,
    ad_relevance: row.ad_relevance,
    landing_page_experience: row.landing_page_experience,
    expected_ctr: row.expected_ctr,
    notes: notes.length ? notes.join("; ") : null,
  };
}

function buildMatchTypeMix(keywords: AdsKeywordQualityRow[]) {
  let broadSpend = 0;
  let phraseSpend = 0;
  let exactSpend = 0;
  let otherSpend = 0;
  let broadCount = 0;
  let phraseCount = 0;
  let exactCount = 0;
  const totalSpend = keywords.reduce((sum, row) => sum + row.cost_micros, 0) || 1;

  for (const row of keywords) {
    const match = row.match_type.toUpperCase();
    if (match.includes("BROAD")) {
      broadSpend += row.cost_micros;
      broadCount += 1;
    } else if (match.includes("PHRASE")) {
      phraseSpend += row.cost_micros;
      phraseCount += 1;
    } else if (match.includes("EXACT")) {
      exactSpend += row.cost_micros;
      exactCount += 1;
    } else {
      otherSpend += row.cost_micros;
    }
  }

  const broadShare = broadSpend / totalSpend;
  return {
    broad_spend_share: broadShare,
    phrase_spend_share: phraseSpend / totalSpend,
    exact_spend_share: exactSpend / totalSpend,
    other_spend_share: otherSpend / totalSpend,
    broad_keyword_count: broadCount,
    phrase_keyword_count: phraseCount,
    exact_keyword_count: exactCount,
    flag_broad_dominant: broadShare > 0.6 && broadCount >= 2,
  };
}

function enrichSearchTerm(row: AdsAuditSearchTermRow) {
  return row;
}

function isDriftTerm(term: string) {
  return DRIFT_PATTERNS.some((pattern) => pattern.test(term));
}

function aggregateSchedule(rows: AdsAuditScheduleRow[]) {
  const byKey = new Map<string, AdsAuditScheduleRow>();
  for (const row of rows) {
    const key = `${row.day_of_week}-${row.hour}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
    } else {
      existing.clicks += row.clicks;
      existing.cost_micros += row.cost_micros;
      existing.conversions += row.conversions;
    }
  }
  return [...byKey.values()]
    .filter((row) => row.clicks >= 5)
    .map((row) => ({
      ...row,
      cpa_micros: microsToCpa(row.cost_micros, row.conversions),
    }));
}

function aggregateDevices(rows: AdsAuditSupplement["devices"]) {
  const byDevice = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = byDevice.get(row.device);
    if (!existing) byDevice.set(row.device, { ...row });
    else {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.cost_micros += row.cost_micros;
      existing.conversions += row.conversions;
    }
  }
  return [...byDevice.values()].map((row) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
  }));
}

function aggregateGeo(rows: AdsAuditSupplement["geography"]) {
  const byLocation = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.location_id}-${row.location_type}`;
    const existing = byLocation.get(key);
    if (!existing) byLocation.set(key, { ...row });
    else {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.cost_micros += row.cost_micros;
      existing.conversions += row.conversions;
    }
  }
  return [...byLocation.values()].map((row) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
  }));
}

function buildPriorities(report: Omit<AdsAuditReport, "priorities">): AdsAuditPriority[] {
  const priorities: AdsAuditPriority[] = [];
  let rank = 1;

  const push = (
    title: string,
    rationale: string,
    severity: AdsAuditPriority["severity"],
  ) => {
    priorities.push({ rank: rank++, title, rationale, severity });
  };

  if (report.search_terms.waste_terms.length > 0) {
    push(
      "Search term cleanup",
      `${report.search_terms.waste_terms.length} search terms spent budget with weak or no conversions.`,
      "critical",
    );
  }
  if (report.search_terms.negative_candidates.length > 0) {
    push(
      "Negative keyword expansion",
      `${report.search_terms.negative_candidates.length} candidate negatives identified from waste and drift patterns.`,
      "critical",
    );
  }
  if (report.match_type_mix.flag_broad_dominant) {
    push(
      "Reduce Broad Match dependence",
      `${Math.round(report.match_type_mix.broad_spend_share * 100)}% of keyword spend is Broad Match.`,
      "critical",
    );
  }
  if (report.quality_score.summary.quality_score_low > 0) {
    push(
      "Improve Quality Scores",
      `${report.quality_score.summary.quality_score_low} keywords at QS ≤ 5; likely inflating CPCs.`,
      "watch",
    );
  }
  if (report.geography.waste_locations.length > 0) {
    push(
      "Tighten geographic targeting",
      `${report.geography.waste_locations.length} locations spent budget without conversions.`,
      "watch",
    );
  }
  if (report.schedule.worst_windows.length > 0) {
    push(
      "Optimize ad schedule",
      "Weak day/hour windows detected with high CPA relative to account baseline.",
      "watch",
    );
  }
  if (report.waste_keywords.length > 0) {
    push(
      "Review underperforming keywords",
      `${report.waste_keywords.length} keywords exceed account CPA or underperform on conversion rate.`,
      "watch",
    );
  }
  if (report.devices.rows.length > 1) {
    push(
      "Evaluate device bid adjustments",
      "Device performance varies — review mobile vs desktop CPA and conversion rate.",
      "info",
    );
  }

  return priorities;
}

export function buildAdsAuditReport(params: {
  accountName: string;
  sync: AdsSyncResult;
  supplement: AdsAuditSupplement;
}): AdsAuditReport {
  const { accountName, sync, supplement } = params;
  const keywords = sync.keywordQuality;
  const accountCpa = microsToCpa(sync.totals.cost_micros, sync.totals.conversions);
  const accountCvr = computeConversionRate(sync.totals.clicks, sync.totals.conversions);

  const auditKeywords = keywords.map((row) => toAuditKeyword(row, accountCpa));

  const topKeywords = [...auditKeywords]
    .filter((row) => row.conversions > 0)
    .sort((left, right) => {
      if (right.conversions !== left.conversions) return right.conversions - left.conversions;
      const leftCpa = left.cpa_micros ?? Number.MAX_SAFE_INTEGER;
      const rightCpa = right.cpa_micros ?? Number.MAX_SAFE_INTEGER;
      return leftCpa - rightCpa;
    })
    .slice(0, 10);

  const wasteKeywords = [...auditKeywords]
    .filter((row) => row.cost_micros >= 500_000)
    .filter((row) => {
      const cpa = row.cpa_micros;
      if (cpa != null && accountCpa != null && cpa > accountCpa * 1.5) return true;
      if (
        accountCvr != null &&
        row.conversion_rate != null &&
        row.conversion_rate < accountCvr * 0.5 &&
        row.clicks >= 10
      ) {
        return true;
      }
      return row.conversions === 0 && row.cost_micros >= 1_000_000;
    })
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 15);

  const qsSummary = summarizeQualityFlags(keywords);
  const lowQualityKeywords = auditKeywords
    .filter(
      (row) =>
        (row.quality_score != null && row.quality_score <= 5) ||
        row.landing_page_experience === "BELOW_AVERAGE" ||
        row.ad_relevance === "BELOW_AVERAGE",
    )
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 20);

  const searchTerms = supplement.searchTerms.map(enrichSearchTerm);
  const topConverting = [...searchTerms]
    .filter((row) => row.conversions > 0)
    .sort((left, right) => right.conversions - left.conversions)
    .slice(0, 15);
  const wasteTerms = [...searchTerms]
    .filter((row) => row.cost_micros >= 500_000 && row.conversions === 0)
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 20);
  const driftTerms = [...searchTerms]
    .filter((row) => isDriftTerm(row.search_term))
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 20);

  const negativeCandidates = new Set<string>();
  for (const term of wasteTerms) {
    const lower = term.search_term.toLowerCase();
    for (const pattern of NEGATIVE_CANDIDATE_PATTERNS) {
      if (lower.includes(pattern)) negativeCandidates.add(pattern);
    }
  }
  for (const term of driftTerms) {
    const words = term.search_term.toLowerCase().split(/\s+/);
    if (words.length <= 3) negativeCandidates.add(term.search_term.toLowerCase());
  }

  const deviceRows = aggregateDevices(supplement.devices);
  const deviceRanked = [...deviceRows].sort(
    (left, right) =>
      (microsToCpa(left.cost_micros, left.conversions) ?? Number.MAX_SAFE_INTEGER) -
      (microsToCpa(right.cost_micros, right.conversions) ?? Number.MAX_SAFE_INTEGER),
  );

  const geoRows = aggregateGeo(supplement.geography);
  const topLocations = [...geoRows]
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 15);
  const wasteLocations = geoRows
    .filter((row) => row.cost_micros >= 500_000 && row.conversions === 0)
    .sort((left, right) => right.cost_micros - left.cost_micros)
    .slice(0, 15);

  const scheduleAgg = aggregateSchedule(supplement.schedule);
  const scheduleWithCpa = scheduleAgg.filter((row) => row.cpa_micros != null);
  const bestWindows = [...scheduleWithCpa]
    .sort((left, right) => (left.cpa_micros ?? 0) - (right.cpa_micros ?? 0))
    .slice(0, 8);
  const worstWindows = [...scheduleWithCpa]
    .sort((left, right) => (right.cpa_micros ?? 0) - (left.cpa_micros ?? 0))
    .slice(0, 8);

  const missingData: string[] = [];
  if (!searchTerms.length) missingData.push("Search Terms Report");
  if (!deviceRows.length) missingData.push("Device breakdown");
  if (!geoRows.length) missingData.push("Geographic performance");
  if (!scheduleAgg.length) missingData.push("Day/hour schedule performance");
  if (!supplement.conversionActions.length) missingData.push("Conversion action definitions");
  if (!keywords.length) missingData.push("Search keyword Quality Score data");

  const partial: Omit<AdsAuditReport, "priorities"> = {
    generated_at: new Date().toISOString(),
    account_name: accountName,
    date_range: { start: sync.startDate, end: sync.endDate },
    executive_snapshot: {
      spend_micros: sync.totals.cost_micros,
      clicks: sync.totals.clicks,
      impressions: sync.totals.impressions,
      conversions: sync.totals.conversions,
      ctr: sync.totals.ctr,
      conversion_rate: accountCvr,
      average_cpc_micros: sync.totals.average_cpc,
      cost_per_conversion_micros: accountCpa,
    },
    match_type_mix: buildMatchTypeMix(keywords),
    top_keywords: topKeywords,
    waste_keywords: wasteKeywords,
    quality_score: {
      summary: {
        total_keywords: qsSummary.totalKeywords,
        flagged_keywords: qsSummary.flaggedKeywords,
        landing_page_below_average: qsSummary.landingPageBelowAverage,
        ad_relevance_below_average: qsSummary.adRelevanceBelowAverage,
        expected_ctr_below_average: qsSummary.expectedCtrBelowAverage,
        quality_score_low: qsSummary.qualityScoreLow,
      },
      low_quality_keywords: lowQualityKeywords,
    },
    search_terms: {
      top_converting: topConverting,
      waste_terms: wasteTerms,
      drift_terms: driftTerms,
      negative_candidates: [...negativeCandidates].slice(0, 30),
    },
    devices: {
      rows: deviceRows,
      best_device: deviceRanked[0]?.device ?? null,
      worst_device: deviceRanked[deviceRanked.length - 1]?.device ?? null,
    },
    geography: {
      top_locations: topLocations,
      waste_locations: wasteLocations,
    },
    schedule: {
      best_windows: bestWindows,
      worst_windows: worstWindows,
    },
    account_metadata: {
      campaigns: supplement.campaigns,
      conversion_actions: supplement.conversionActions,
    },
    missing_data: missingData,
  };

  return {
    ...partial,
    priorities: buildPriorities(partial),
  };
}
