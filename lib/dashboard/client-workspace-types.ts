import type {
  AdsSignal,
  AdsSnapshot,
  BasecampThreadEvent,
  ClientRow,
  GbpReviewRow,
  GbpSnapshot,
  GscPageMetric,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
  LighthouseOccurrenceOverride,
  LighthouseSnapshot,
  SeoCrawlIssue,
  SeoCrawlSnapshot,
  SitemapSnapshot,
  SitemapUrlRow,
  SocialConnection,
  SocialDailySnapshot,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";

export type ClientDetailTab =
  | "profile"
  | "onboarding"
  | "connections"
  | "comms"
  | "reporting"
  | "seo_ops"
  | "seo"
  | "ads"
  | "sitemaps"
  | "social"
  | "actions";

export const CLIENT_DETAIL_TABS = new Set<string>([
  "profile",
  "onboarding",
  "connections",
  "comms",
  "reporting",
  "seo_ops",
  "seo",
  "ads",
  "sitemaps",
  "social",
  "actions",
]);

export function parseClientDetailTab(value: string | undefined | null): ClientDetailTab | null {
  if (!value || !CLIENT_DETAIL_TABS.has(value)) return null;
  return value as ClientDetailTab;
}

export type ClientWorkspaceInitialData = {
  client: ClientRow;
  threadEvents: BasecampThreadEvent[];
  lighthouseSnapshot: LighthouseSnapshot | null;
  lighthouseOverrides: LighthouseOccurrenceOverride[];
  seoCrawlSnapshot: SeoCrawlSnapshot | null;
  seoCrawlIssues: SeoCrawlIssue[];
  gscSnapshot: GscSnapshot | null;
  gscSignals: GscSignal[];
  gscPageMetrics: GscPageMetric[];
  gscQueryMetrics: GscQueryMetric[];
  sitemapSnapshot: SitemapSnapshot | null;
  sitemapUrls: SitemapUrlRow[];
  socialConnections: SocialConnection[];
  socialDailySnapshots: SocialDailySnapshot[];
  socialPostSnapshots: SocialPostSnapshot[];
  socialSignals: SocialSignal[];
  adsSnapshot: AdsSnapshot | null;
  adsSignals: AdsSignal[];
  gbpSnapshot: GbpSnapshot | null;
  gbpReviews: GbpReviewRow[];
  hasDuplicateBasecampProjectId: boolean;
};
