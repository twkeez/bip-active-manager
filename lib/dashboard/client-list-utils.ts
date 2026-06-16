import {
  buildBaselineTechnicalFindings,
  computeClientUrgencyScore,
} from "@/lib/reporting/build-report";
import type { ClientFreshness, SignalSummary } from "@/lib/dashboard/snapshot-queries";
import type { ClientRow } from "@/lib/types/client";

export type ListTechnicalFinding = {
  id: string;
  channel: "seo" | "ads" | "sitemaps" | "social";
  title: string;
  severity: "critical" | "watch";
  status: "open";
  confidence: "high" | "medium";
  impact: "high" | "medium";
  detectedAt: string;
  dueLabel: string;
};

export type ListTechnicalSummary = {
  health: "Good" | "Watch" | "Critical";
  openCount: number;
  hasCritical: boolean;
  findings: ListTechnicalFinding[];
};

export function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

export function buildListTechnicalSummary(client: ClientRow): ListTechnicalSummary {
  const findings: ListTechnicalFinding[] = buildBaselineTechnicalFindings(client).map((finding) => ({
    ...finding,
    status: "open" as const,
    confidence: finding.severity === "critical" ? ("high" as const) : ("medium" as const),
    impact: finding.severity === "critical" ? ("high" as const) : ("medium" as const),
    dueLabel: finding.severity === "critical" ? "Today" : "This week",
  }));
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const openCount = findings.length;
  return {
    findings,
    hasCritical,
    openCount,
    health: hasCritical ? "Critical" : openCount > 0 ? "Watch" : "Good",
  };
}

function staleAgeDays(value: string | null | undefined) {
  if (!value) return null;
  const diff = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24);
  return Number.isFinite(diff) ? diff : null;
}

export function computeListUrgencyScore(input: {
  client: ClientRow;
  technical: ListTechnicalSummary;
  gscSignals: SignalSummary | undefined;
  adsSignals: SignalSummary | undefined;
  freshness: ClientFreshness | undefined;
}) {
  const staleSourceCount = [
    staleAgeDays(input.freshness?.adsUpdatedAt),
    staleAgeDays(input.freshness?.gscUpdatedAt),
    staleAgeDays(input.freshness?.lighthouseFetchedAt ?? input.freshness?.crawlUpdatedAt),
    staleAgeDays(input.freshness?.sitemapUpdatedAt),
    staleAgeDays(input.freshness?.socialCreatedAt),
    staleAgeDays(input.freshness?.gbpUpdatedAt),
  ].filter((days) => days != null && days > 14).length;

  return computeClientUrgencyScore({
    needsReply: input.client.needs_reply,
    staleDays: input.client.days_stale,
    hasCriticalTechnical: input.technical.hasCritical,
    hasCriticalAds: input.adsSignals?.hasCritical ?? false,
    hasCriticalGsc: input.gscSignals?.hasCritical ?? false,
    missingScUrl: !norm(input.client.sc_url),
    missingAdsCustomerId: !norm(input.client.ads_customer_id),
    staleSourceCount,
  });
}

export function toMatchTokens(value: string | null | undefined) {
  return norm(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3);
}

export function isLikelyOwnedByCurrentUser(
  strategist: string | null | undefined,
  userEmail: string | undefined,
) {
  if (!userEmail) return false;
  const strategistTokens = toMatchTokens(strategist);
  if (strategistTokens.length === 0) return false;
  const emailLocal = userEmail.split("@")[0] ?? "";
  const userTokens = toMatchTokens(emailLocal);
  if (userTokens.length === 0) return false;
  return userTokens.some((token) => strategistTokens.some((part) => part.includes(token)));
}

export function uniqueSorted(values: (string | null | undefined)[]) {
  const set = new Set<string>();
  for (const v of values) {
    const t = norm(v);
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString();
}

export function previewThreadText(preview: {
  thread_excerpt: string | null;
  thread_title: string | null;
}) {
  return (
    norm(preview.thread_excerpt) ||
    norm(preview.thread_title) ||
    "No preview available."
  );
}
