export type PlaybookItemType = "checklist" | "deliverable" | "guideline";

export type PlaybookItem = {
  id: number;
  tier_key: string;
  category: string;
  type: PlaybookItemType;
  title: string;
  body: string | null;
  auto_verify_key: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceTier = {
  id: number;
  tier_key: string;
  service: string;
  tier_label: string;
  tier_rank: number;
  title: string;
  objective: string;
  tactics: string[];
  enabled: boolean;
};

export type VerifyKey =
  | "gsc_connected"
  | "ads_synced"
  | "ga4_connected"
  | "gbp_connected"
  | "basecamp_linked"
  | "harvest_linked";

export type VerifyResult = {
  key: VerifyKey;
  label: string;
  pass: boolean;
};
