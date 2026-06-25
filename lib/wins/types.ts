// "Wins" — brag-worthy client results mined from snapshot data, used to draft
// Beyond Indigo's own social promotion. Client names are shown internally but
// posts are anonymized unless a win is explicitly opted in.

export type WinSource = "ads" | "organic" | "social";

export type Win = {
  id: string; // stable key: `${source}:${client_id}:${kind}`
  source: WinSource;
  channel_label: string; // e.g. "Google Ads", "Website traffic", "Search rankings", "Social"
  client_id: number;
  client_name: string;
  kind: string; // machine kind, e.g. "ads_cpa", "ga4_sessions_growth"
  metric_label: string; // e.g. "Cost per lead", "Organic traffic"
  metric_value: string; // formatted headline number, e.g. "$8", "+45%", "4.8★"
  context: string; // one-line human context (internal — may reference the client)
  period: string; // e.g. "last 30 days"
  score: number; // impressiveness ranking (higher = better)
};

export type SocialPlatform = "linkedin" | "facebook" | "instagram";

// One win as submitted for drafting, with the per-win naming decision.
export type WinDraftInput = {
  win: Win;
  use_name: boolean; // include the real client name in the post (default false)
};

export type DraftedPostVariant = {
  text: string;
  hashtags: string[];
};

export type DraftedPlatformPosts = {
  platform: SocialPlatform;
  variants: DraftedPostVariant[];
};
