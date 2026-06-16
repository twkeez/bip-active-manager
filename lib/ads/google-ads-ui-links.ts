import { normalizeCustomerId } from "@/lib/ads/customer-id";
import type { GlobalAdsIssue, GlobalAdsIssueType } from "@/lib/ads/global-optimization";

const ISSUE_DESTINATION: Record<
  GlobalAdsIssueType,
  { path: string; label: string }
> = {
  ad_relevance: { path: "/aw/ads", label: "Ads & assets" },
  expected_ctr: { path: "/aw/adextensions", label: "Ad extensions" },
  low_quality_score: { path: "/aw/keywords", label: "Keywords" },
  budget_capped: { path: "/aw/campaigns", label: "Campaigns" },
  rank_lost: { path: "/aw/campaigns", label: "Campaigns" },
};

export function formatGoogleAdsCustomerId(raw: string | null | undefined) {
  const digits = normalizeCustomerId(raw ?? "");
  if (digits.length !== 10) return digits || null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function buildGoogleAdsUiUrl(input: {
  adsCustomerId: string | null | undefined;
  issueType: GlobalAdsIssueType;
  campaignId?: string | null;
  adGroupId?: string | null;
}): string | null {
  const customerId = normalizeCustomerId(input.adsCustomerId ?? "");
  if (!/^\d{10}$/.test(customerId)) return null;

  const destination = ISSUE_DESTINATION[input.issueType];
  const url = new URL(`https://ads.google.com${destination.path}`);
  url.searchParams.set("__e", customerId);

  if (input.campaignId?.trim()) {
    url.searchParams.set("campaignId", input.campaignId.trim());
  }
  if (input.adGroupId?.trim()) {
    url.searchParams.set("adGroupId", input.adGroupId.trim());
  }

  return url.toString();
}

export function buildGoogleAdsOptimizeTarget(issue: GlobalAdsIssue) {
  const externalUrl = buildGoogleAdsUiUrl({
    adsCustomerId: issue.adsCustomerId,
    issueType: issue.issueType,
    campaignId: issue.campaignId,
    adGroupId: issue.adGroupId,
  });

  return {
    externalUrl,
    workspaceUrl: `/dashboard/clients/${issue.clientId}?tab=ads`,
    destinationLabel: ISSUE_DESTINATION[issue.issueType].label,
    formattedCustomerId: formatGoogleAdsCustomerId(issue.adsCustomerId),
  };
}
