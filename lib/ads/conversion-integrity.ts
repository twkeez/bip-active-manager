import type { AdsCampaignMetric, AdsSnapshot } from "@/lib/types/client";

export const IMPLAUSIBLE_CONV_RATE_THRESHOLD = 0.45;
export const IMPLAUSIBLE_CONV_RATE_MIN_CLICKS = 10;

export type ConversionAnomalyType = "pixel_loop" | "implausible_rate";

export type ConversionAnomalySeverity = "critical" | "high";

export type ConversionIntegrityAnomaly = {
  id: string;
  clientId: number;
  accountName: string;
  accountIdLabel: string;
  adsCustomerId: string | null;
  campaignId: string;
  campaignName: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  conversionRateLabel: string;
  anomalyType: ConversionAnomalyType;
  anomalyLabel: string;
  severity: ConversionAnomalySeverity;
  sortWeight: number;
};

export type ConversionIntegritySummary = {
  activeAnomalies: number;
  criticalCount: number;
  highCount: number;
  accountsAffected: number;
  campaignsScanned: number;
  accountsScanned: number;
};

type ClientRef = {
  id: number;
  account_name: string;
  ads_customer_id: string | null;
};

function formatConversionRate(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function anomalyLabel(type: ConversionAnomalyType) {
  if (type === "pixel_loop") return "Pixel Loop Detected";
  return "Suspect Confirmation Trigger";
}

function detectCampaignAnomalies(input: {
  client: ClientRef;
  campaign: AdsCampaignMetric;
}): ConversionIntegrityAnomaly[] {
  const { client, campaign } = input;
  const { clicks, conversions } = campaign;
  if (clicks <= 0) return [];

  const conversionRate = conversions / clicks;
  const anomalies: ConversionIntegrityAnomaly[] = [];

  const base = {
    clientId: client.id,
    accountName: client.account_name,
    accountIdLabel: `#${client.id}`,
    adsCustomerId: client.ads_customer_id,
    campaignId: campaign.campaign_id,
    campaignName: campaign.campaign_name,
    clicks,
    conversions,
    conversionRate,
    conversionRateLabel: formatConversionRate(conversionRate),
  };

  if (conversions >= clicks) {
    anomalies.push({
      ...base,
      id: `${client.id}:${campaign.campaign_id}:pixel_loop`,
      anomalyType: "pixel_loop",
      anomalyLabel: anomalyLabel("pixel_loop"),
      severity: "critical",
      sortWeight: 3_000_000 + conversions,
    });
    return anomalies;
  }

  if (clicks > IMPLAUSIBLE_CONV_RATE_MIN_CLICKS && conversionRate > IMPLAUSIBLE_CONV_RATE_THRESHOLD) {
    anomalies.push({
      ...base,
      id: `${client.id}:${campaign.campaign_id}:implausible_rate`,
      anomalyType: "implausible_rate",
      anomalyLabel: anomalyLabel("implausible_rate"),
      severity: "high",
      sortWeight: 2_000_000 + Math.round(conversionRate * 1000),
    });
  }

  return anomalies;
}

export function buildConversionIntegrityAnomalies(input: {
  clients: ClientRef[];
  snapshots: AdsSnapshot[];
}): ConversionIntegrityAnomaly[] {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const anomalies: ConversionIntegrityAnomaly[] = [];

  for (const snapshot of input.snapshots) {
    if (snapshot.run_status !== "completed") continue;
    const client = clientById.get(snapshot.client_id);
    if (!client) continue;

    for (const campaign of snapshot.campaigns ?? []) {
      anomalies.push(...detectCampaignAnomalies({ client, campaign }));
    }
  }

  return anomalies.sort((left, right) => right.sortWeight - left.sortWeight);
}

export function summarizeConversionIntegrity(
  anomalies: ConversionIntegrityAnomaly[],
  input: { campaignsScanned: number; accountsScanned: number },
): ConversionIntegritySummary {
  const accountIds = new Set(anomalies.map((row) => row.clientId));
  return {
    activeAnomalies: anomalies.length,
    criticalCount: anomalies.filter((row) => row.severity === "critical").length,
    highCount: anomalies.filter((row) => row.severity === "high").length,
    accountsAffected: accountIds.size,
    campaignsScanned: input.campaignsScanned,
    accountsScanned: input.accountsScanned,
  };
}

/**
 * What to check for an anomaly: standing guidance by type. This was once shown
 * as the result of an "Inspect landing code" scan that never looked at the
 * site; it is the same advice, now labelled for what it is.
 */
export function whatToCheck(anomaly: Pick<ConversionIntegrityAnomaly, "anomalyType" | "conversionRateLabel" | "clicks">): string[] {
  return anomaly.anomalyType === "pixel_loop"
    ? [
        "Conversions match or exceed clicks: usually a tag firing twice or on page load.",
        "In Tag Assistant or GTM preview, confirm the conversion tag fires once per thank-you page view.",
        "Check whether a conversion action counts every site engagement instead of qualified leads.",
      ]
    : [
        `A ${anomaly.conversionRateLabel} conversion rate on ${anomaly.clicks} clicks is above the ${IMPLAUSIBLE_CONV_RATE_THRESHOLD * 100}% we'd believe.`,
        "Review the confirmation-page rules, and whether small actions are counted as primary goals.",
        "Check the attribution window and for duplicate imported conversion actions.",
      ];
}
