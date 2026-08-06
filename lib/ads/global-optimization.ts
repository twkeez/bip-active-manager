import { formatCostMicros, isBelowAverage } from "@/lib/ads/quality-score";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { lostIsCritical, lostIsWatch } from "@/lib/ads/thresholds";
import type { AdsCampaignMetric, AdsKeywordQualityRow, AdsSnapshot } from "@/lib/types/client";

// Budget vs rank use different cutoffs, from the shared source of truth. The
// roll-up flags at the WATCH tier.
const lostMetric = (issueType: "budget_capped" | "rank_lost") =>
  issueType === "budget_capped" ? "budget" : "rank";

export type GlobalAdsIssueType =
  | "ad_relevance"
  | "expected_ctr"
  | "low_quality_score"
  | "budget_capped"
  | "rank_lost";

export type GlobalAdsIssueSeverity = "critical" | "high" | "medium";

export type GlobalAdsIssue = {
  id: string;
  clientId: number;
  accountName: string;
  accountIdLabel: string;
  adsCustomerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  issueType: GlobalAdsIssueType;
  issueLabel: string;
  target: string;
  impact: string;
  severity: GlobalAdsIssueSeverity;
  sortWeight: number;
};

export type GlobalAdsOptimizationSummary = {
  budgetCappedAccountCount: number;
  relevanceCtrAccountCount: number;
  totalIssues: number;
  connectedAccountCount: number;
  accountsWithIssues: number;
};

type ClientRef = {
  id: number;
  account_name: string;
  ads_customer_id: string | null;
};

function severityWeight(severity: GlobalAdsIssueSeverity) {
  if (severity === "critical") return 3;
  if (severity === "high") return 2;
  return 1;
}

function lostIsSeverity(pct: number, metric: "budget" | "rank"): GlobalAdsIssueSeverity {
  if (pct >= lostIsCritical(metric)) return "critical";
  if (pct >= lostIsWatch(metric)) return "high";
  return "medium";
}

function qualityScoreSeverity(score: number): GlobalAdsIssueSeverity {
  if (score <= 3) return "critical";
  if (score <= 5) return "high";
  return "medium";
}

function pushKeywordIssue(
  issues: GlobalAdsIssue[],
  input: {
    client: ClientRef;
    row: AdsKeywordQualityRow;
    issueType: GlobalAdsIssueType;
    issueLabel: string;
    impact: string;
    severity: GlobalAdsIssueSeverity;
  },
) {
  issues.push({
    id: `${input.client.id}:${input.issueType}:${input.row.campaign_id}:${input.row.ad_group_id}:${input.row.criterion_id}`,
    clientId: input.client.id,
    accountName: input.client.account_name,
    accountIdLabel: `#${input.client.id}`,
    adsCustomerId: input.client.ads_customer_id,
    campaignId: input.row.campaign_id,
    adGroupId: input.row.ad_group_id,
    issueType: input.issueType,
    issueLabel: input.issueLabel,
    target: input.row.keyword,
    impact: input.impact,
    severity: input.severity,
    sortWeight: severityWeight(input.severity) * 1_000_000 + input.row.cost_micros,
  });
}

function pushCampaignLostIsIssue(
  issues: GlobalAdsIssue[],
  input: {
    client: ClientRef;
    campaign: AdsCampaignMetric;
    issueType: "budget_capped" | "rank_lost";
    issueLabel: string;
    lostShare: number;
  },
) {
  const metric = lostMetric(input.issueType);
  const pct = input.lostShare * 100;
  if (pct <= lostIsWatch(metric)) return;
  const severity = lostIsSeverity(pct, metric);
  issues.push({
    id: `${input.client.id}:${input.issueType}:${input.campaign.campaign_id}`,
    clientId: input.client.id,
    accountName: input.client.account_name,
    accountIdLabel: `#${input.client.id}`,
    adsCustomerId: input.client.ads_customer_id,
    campaignId: input.campaign.campaign_id,
    adGroupId: null,
    issueType: input.issueType,
    issueLabel: input.issueLabel,
    target: input.campaign.campaign_name,
    impact: `${pct.toFixed(2)}% Impression Share Loss`,
    severity,
    sortWeight: severityWeight(severity) * 1_000_000 + input.campaign.cost_micros,
  });
}

export function buildGlobalAdsIssues(input: {
  clients: ClientRef[];
  snapshots: AdsSnapshot[];
}): GlobalAdsIssue[] {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const issues: GlobalAdsIssue[] = [];

  for (const snapshot of input.snapshots) {
    const client = clientById.get(snapshot.client_id);
    if (!client || !isSyncableAdsCustomerId(client.ads_customer_id)) continue;

    const keywordQuality = snapshot.keyword_quality ?? [];
    for (const row of keywordQuality) {
      if (isBelowAverage(row.ad_relevance)) {
        pushKeywordIssue(issues, {
          client,
          row,
          issueType: "ad_relevance",
          issueLabel: "Ad Relevance",
          impact: "Elevated Cost-Per-Click Tax",
          severity: row.cost_micros >= 500_000 ? "critical" : "high",
        });
      }
      if (isBelowAverage(row.expected_ctr)) {
        pushKeywordIssue(issues, {
          client,
          row,
          issueType: "expected_ctr",
          issueLabel: "Expected CTR",
          impact: "Below Average Traffic Yield",
          severity: "medium",
        });
      }
      if (typeof row.quality_score === "number" && row.quality_score <= 5) {
        pushKeywordIssue(issues, {
          client,
          row,
          issueType: "low_quality_score",
          issueLabel: "Low Quality Score",
          impact: `${row.quality_score}/10 Score — Budget Drain`,
          severity: qualityScoreSeverity(row.quality_score),
        });
      }
    }

    const campaigns = snapshot.campaigns ?? [];
    let hasCampaignBudgetIssue = false;
    let hasCampaignRankIssue = false;

    for (const campaign of campaigns) {
      if (typeof campaign.search_budget_lost_impression_share === "number") {
        pushCampaignLostIsIssue(issues, {
          client,
          campaign,
          issueType: "budget_capped",
          issueLabel: "Budget Capped",
          lostShare: campaign.search_budget_lost_impression_share,
        });
        if (campaign.search_budget_lost_impression_share * 100 > lostIsWatch("budget")) {
          hasCampaignBudgetIssue = true;
        }
      }
      if (typeof campaign.search_rank_lost_impression_share === "number") {
        pushCampaignLostIsIssue(issues, {
          client,
          campaign,
          issueType: "rank_lost",
          issueLabel: "Ad Rank Loss",
          lostShare: campaign.search_rank_lost_impression_share,
        });
        if (campaign.search_rank_lost_impression_share * 100 > lostIsWatch("rank")) {
          hasCampaignRankIssue = true;
        }
      }
    }

    const budgetLost = snapshot.totals.search_budget_lost_impression_share;
    if (
      !hasCampaignBudgetIssue &&
      typeof budgetLost === "number" &&
      budgetLost * 100 > lostIsWatch("budget")
    ) {
      const pct = budgetLost * 100;
      const severity = lostIsSeverity(pct, "budget");
      issues.push({
        id: `${client.id}:budget_capped:account`,
        clientId: client.id,
        accountName: client.account_name,
        accountIdLabel: `#${client.id}`,
        adsCustomerId: client.ads_customer_id,
        campaignId: null,
        adGroupId: null,
        issueType: "budget_capped",
        issueLabel: "Budget Capped",
        target: "Account Search",
        impact: `${pct.toFixed(2)}% Impression Share Loss`,
        severity,
        sortWeight: severityWeight(severity) * 1_000_000,
      });
    }

    const rankLost = snapshot.totals.search_rank_lost_impression_share;
    if (
      !hasCampaignRankIssue &&
      typeof rankLost === "number" &&
      rankLost * 100 > lostIsWatch("rank")
    ) {
      const pct = rankLost * 100;
      const severity = lostIsSeverity(pct, "rank");
      issues.push({
        id: `${client.id}:rank_lost:account`,
        clientId: client.id,
        accountName: client.account_name,
        accountIdLabel: `#${client.id}`,
        adsCustomerId: client.ads_customer_id,
        campaignId: null,
        adGroupId: null,
        issueType: "rank_lost",
        issueLabel: "Ad Rank Loss",
        target: "Account Search",
        impact: `${pct.toFixed(2)}% Impression Share Loss`,
        severity,
        sortWeight: severityWeight(severity) * 1_000_000,
      });
    }
  }

  return issues.sort((left, right) => {
    if (right.sortWeight !== left.sortWeight) return right.sortWeight - left.sortWeight;
    return left.accountName.localeCompare(right.accountName);
  });
}

export function summarizeGlobalAdsIssues(issues: GlobalAdsIssue[]): GlobalAdsOptimizationSummary {
  const budgetClients = new Set<number>();
  const relevanceCtrClients = new Set<number>();
  const accountsWithIssues = new Set<number>();

  for (const issue of issues) {
    accountsWithIssues.add(issue.clientId);
    if (issue.issueType === "budget_capped" || issue.issueType === "rank_lost") {
      budgetClients.add(issue.clientId);
    }
    if (
      issue.issueType === "ad_relevance" ||
      issue.issueType === "expected_ctr" ||
      issue.issueType === "low_quality_score"
    ) {
      relevanceCtrClients.add(issue.clientId);
    }
  }

  return {
    budgetCappedAccountCount: budgetClients.size,
    relevanceCtrAccountCount: relevanceCtrClients.size,
    totalIssues: issues.length,
    connectedAccountCount: 0,
    accountsWithIssues: accountsWithIssues.size,
  };
}

export function formatKeywordSpendImpact(costMicros: number) {
  return `${formatCostMicros(costMicros)} spend (30d)`;
}
