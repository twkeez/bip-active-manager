/**
 * The GOAL of a post — a second axis alongside campaign_type, which is the
 * FORMAT (pet_of_month, before_after, …).
 */
export type SocialPurpose =
  | "services"
  | "fun"
  | "engagement"
  | "educational"
  | "promotional"
  | "community";

export const SOCIAL_PURPOSES: SocialPurpose[] = [
  "services",
  "fun",
  "engagement",
  "educational",
  "promotional",
  "community",
];

/** Where an idea row came from. */
export type SocialIdeaSource = "manual" | "ai_saved" | "seed";

export type SocialIdea = {
  id: number;
  /** NULL = global idea suggested for every client; set = specific to that client. */
  client_id: number | null;
  title: string;
  description: string;
  campaign_type: string;
  /** Browsing bucket for the repository accordion. NULL = Uncategorized. */
  category: string | null;
  /** Defaults the post editor pre-fills with when this idea is placed. */
  default_pillar: string | null;
  default_subheadline: string | null;
  default_photo_suggestion: string | null;
  purpose: SocialPurpose | null;
  source: SocialIdeaSource;
  tags: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Series ───────────────────────────────────────────────────────────────────

/** recurring = a slot that repeats; arc = an ordered, finite story in parts. */
export type SocialSeriesKind = "recurring" | "arc";

export type SocialSeriesCadence = "weekly" | "biweekly" | "monthly";

export type SocialSeries = {
  id: number;
  /** NULL = global series available to every client. */
  client_id: number | null;
  title: string;
  description: string;
  kind: SocialSeriesKind;
  campaign_type: string;
  purpose: SocialPurpose | null;
  tags: string[];
  /** recurring only — null on arc series. */
  cadence: SocialSeriesCadence | null;
  /** recurring only — 0=Sunday .. 6=Saturday. */
  day_of_week: number | null;
  /** arc only — days between consecutive parts. */
  spacing_days: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialSeriesPart = {
  id: number;
  series_id: number;
  part_number: number;
  title: string;
  description: string;
  suggested_shot: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialSeriesWithParts = SocialSeries & {
  parts: SocialSeriesPart[];
};

// ─── Awareness days ───────────────────────────────────────────────────────────

export type AwarenessRuleType = "fixed" | "nth_weekday" | "week_of" | "month_long";

/**
 * A date rule for a recurring awareness day. Which fields are populated depends
 * on rule_type — the database CHECK constraint enforces the combinations:
 *
 *   fixed       → day
 *   nth_weekday → nth + weekday
 *   week_of     → duration_days, plus EITHER week_start_day OR (nth + weekday)
 *   month_long  → none of the above
 *
 * Resolve to real dates with resolveAwarenessDate() in ./awareness-resolver.
 */
export type SocialAwarenessDay = {
  id: number;
  name: string;
  description: string;
  content_angle: string;
  rule_type: AwarenessRuleType;
  month: number;
  /** fixed: the day of the month. */
  day: number | null;
  /** 1..5 = that occurrence in the month; -1 = the last occurrence. */
  nth: number | null;
  /** 0=Sunday .. 6=Saturday. */
  weekday: number | null;
  /** week_of, fixed-start form: the day of month the week begins on. */
  week_start_day: number | null;
  /** week_of: length of the window, counting the start day itself. */
  duration_days: number | null;
  series_id: number | null;
  /** False until a human has confirmed the rule against a real source. */
  verified: boolean;
  source_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StandingCampaign = {
  name: string;
  description: string;
};

export type SocialClientProfile = {
  id: number;
  client_id: number;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standing_campaigns: StandingCampaign[];
  posts_per_week: number;
  created_at: string;
  updated_at: string;
};

export type SocialContentPlan = {
  id: number;
  client_id: number;
  plan_month: number;
  plan_year: number;
  status: "draft" | "approved" | "sent_to_client";
  campaign_types_used: string[];
  awareness_days_used: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PostStatus = "idea" | "brief_sent" | "asset_received" | "drafted" | "approved" | "scheduled" | "posted";

export type SocialContentPost = {
  id: number;
  plan_id: number;
  client_id: number;
  post_date: string;
  platform: "both" | "instagram" | "facebook";
  campaign_type: string;
  campaign_label: string;
  // ── The export sheet's shape. These five fields ARE the SMM team handoff. ──
  content_pillar: string | null;
  headline: string | null;
  subheadline: string | null;
  photo_suggestion: string | null;
  /** @deprecated Superseded by headline/subheadline. Kept so drafts survive. */
  caption_draft: string | null;
  /** @deprecated Superseded by photo_suggestion. */
  shot_list: string | null;
  /** @deprecated Not part of the export sheet. */
  hashtags: string | null;
  status: PostStatus;
  sort_order: number;
  // Provenance — where this post came from. All nullable; a post may have none.
  idea_id: number | null;
  series_id: number | null;
  /** Which part of an arc series this post is, when series_id is an arc. */
  series_part: number | null;
  awareness_day_id: number | null;
  created_at: string;
  updated_at: string;
};

export type SocialPlanWithPosts = SocialContentPlan & {
  posts: SocialContentPost[];
};

/**
 * One line of the month's photo brief. When post_id is set, `body` mirrors that
 * post's shot_list (a single text string, not an array) — edits here must be
 * written back to social_content_posts.shot_list to stay in sync.
 */
export type SocialPhotoListItem = {
  id: number;
  plan_id: number;
  /** NULL = a standalone ask not tied to any post. */
  post_id: number | null;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GeneratedPost = {
  post_date: string;
  platform: "both" | "instagram" | "facebook";
  campaign_type: string;
  campaign_label: string;
  caption_draft: string;
  shot_list: string;
  hashtags: string;
};

/**
 * A month's seasonal list is hidden until someone confirms that year's dates —
 * awareness days move year to year, so last year's list is not trustworthy.
 * A row's existence IS the verification; absence means unverified.
 */
export type SocialAwarenessVerification = {
  id: number;
  year: number;
  month: number;
  verified_at: string;
  verified_by: string | null;
};
