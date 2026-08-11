export type SocialIdea = {
  id: number;
  title: string;
  description: string;
  campaign_type: string;
  tags: string[];
  is_active: boolean;
  created_by: string | null;
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
  caption_draft: string | null;
  shot_list: string | null;
  hashtags: string | null;
  status: PostStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SocialPlanWithPosts = SocialContentPlan & {
  posts: SocialContentPost[];
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
