import { formatCostMicros, isBelowAverage } from "@/lib/ads/quality-score";
import type { AdsKeywordQualityRow, AdsSnapshot } from "@/lib/types/client";

export const BUDGET_HOG_SPEND_SHARE_THRESHOLD = 0.3;
export const BUDGET_HOG_MAX_CONVERSIONS = 1;

export type LpDeficitItem = {
  id: string;
  clientId: number;
  accountName: string;
  accountIdLabel: string;
  adsCustomerId: string | null;
  campaignId: string;
  campaignName: string;
  keyword: string;
  status: "LP Below Average";
  costMicros: number;
  costLabel: string;
  sortWeight: number;
};

export type BudgetHogItem = {
  id: string;
  clientId: number;
  accountName: string;
  accountIdLabel: string;
  adsCustomerId: string | null;
  campaignId: string;
  campaignName: string;
  keyword: string;
  keywordSpendMicros: number;
  keywordSpendLabel: string;
  totalSpendMicros: number;
  totalSpendLabel: string;
  pctOfBudget: number;
  pctOfBudgetLabel: string;
  conversions: number;
  sortWeight: number;
};

export type PpcDefenseSummary = {
  lpDeficitCount: number;
  budgetHogCount: number;
  lpAccountsAffected: number;
  hogAccountsAffected: number;
  accountsScanned: number;
  keywordsScanned: number;
};

type ClientRef = {
  id: number;
  account_name: string;
  ads_customer_id: string | null;
};

function microsToDollars(micros: number) {
  return micros / 1_000_000;
}

function formatDollars(micros: number) {
  return formatCostMicros(micros);
}

export function buildLpDeficits(input: {
  clients: ClientRef[];
  snapshots: AdsSnapshot[];
}): LpDeficitItem[] {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const items: LpDeficitItem[] = [];

  for (const snapshot of input.snapshots) {
    if (snapshot.run_status !== "completed") continue;
    const client = clientById.get(snapshot.client_id);
    if (!client) continue;

    for (const row of snapshot.keyword_quality ?? []) {
      if (!isBelowAverage(row.landing_page_experience)) continue;
      items.push({
        id: `${client.id}:lp:${row.campaign_id}:${row.ad_group_id}:${row.criterion_id}`,
        clientId: client.id,
        accountName: client.account_name,
        accountIdLabel: `#${client.id}`,
        adsCustomerId: client.ads_customer_id,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        keyword: row.keyword,
        status: "LP Below Average",
        costMicros: row.cost_micros,
        costLabel: formatDollars(row.cost_micros),
        sortWeight: row.cost_micros,
      });
    }
  }

  return items.sort((left, right) => right.sortWeight - left.sortWeight);
}

export function buildBudgetHogs(input: {
  clients: ClientRef[];
  snapshots: AdsSnapshot[];
}): BudgetHogItem[] {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const items: BudgetHogItem[] = [];

  for (const snapshot of input.snapshots) {
    if (snapshot.run_status !== "completed") continue;
    const client = clientById.get(snapshot.client_id);
    if (!client) continue;

    const totalSpendMicros = snapshot.totals.cost_micros;
    if (totalSpendMicros <= 0) continue;

    for (const row of snapshot.keyword_quality ?? []) {
      if (row.cost_micros <= 0) continue;
      const share = row.cost_micros / totalSpendMicros;
      if (share <= BUDGET_HOG_SPEND_SHARE_THRESHOLD) continue;
      if (row.conversions >= 2) continue;

      const pct = share * 100;
      items.push({
        id: `${client.id}:hog:${row.campaign_id}:${row.ad_group_id}:${row.criterion_id}`,
        clientId: client.id,
        accountName: client.account_name,
        accountIdLabel: `#${client.id}`,
        adsCustomerId: client.ads_customer_id,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        keyword: row.keyword,
        keywordSpendMicros: row.cost_micros,
        keywordSpendLabel: formatDollars(row.cost_micros),
        totalSpendMicros,
        totalSpendLabel: formatDollars(totalSpendMicros),
        pctOfBudget: pct,
        pctOfBudgetLabel: `${pct.toFixed(1)}%`,
        conversions: row.conversions,
        sortWeight: Math.round(pct * 1000) + row.cost_micros,
      });
    }
  }

  return items.sort((left, right) => right.sortWeight - left.sortWeight);
}

export function summarizePpcDefense(input: {
  lpDeficits: LpDeficitItem[];
  budgetHogs: BudgetHogItem[];
  accountsScanned: number;
  keywordsScanned: number;
}): PpcDefenseSummary {
  return {
    lpDeficitCount: input.lpDeficits.length,
    budgetHogCount: input.budgetHogs.length,
    lpAccountsAffected: new Set(input.lpDeficits.map((row) => row.clientId)).size,
    hogAccountsAffected: new Set(input.budgetHogs.map((row) => row.clientId)).size,
    accountsScanned: input.accountsScanned,
    keywordsScanned: input.keywordsScanned,
  };
}

export function buildWebDevExportPayload(lpDeficits: LpDeficitItem[]) {
  const lines = [
    "Landing Page Experience Deficit — Web Dev Assignment",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...lpDeficits.map(
      (item, index) =>
        `${index + 1}. ${item.accountName} (${item.accountIdLabel})\n   Campaign: ${item.campaignName}\n   Keyword: "${item.keyword}"\n   Status: ${item.status}\n   30d spend on keyword: ${item.costLabel}\n   Action: Review destination URL for message match, mobile UX, and load speed.`,
    ),
  ];
  return lines.join("\n\n");
}

export function budgetHogDollars(micros: number) {
  return microsToDollars(micros);
}
