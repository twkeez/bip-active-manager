export type IlluminareClientStatus =
  | "active"
  | "onboarding"
  | "paused"
  | "offboarded";

export type IlluminareEngagementType = "retainer" | "project" | "hybrid";

export type IlluminareClientRow = {
  id: number;
  account_name: string;
  account_lead: string | null;
  status: IlluminareClientStatus;
  website: string | null;
  basecamp_project_id: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  engagement_type: IlluminareEngagementType | null;
  scope_summary: string | null;
  retainer_notes: string | null;
  goals: string | null;
  strategy: string | null;
  progress_notes: string | null;
  created_at: string;
  updated_at: string;
};

export const ILLUMINARE_CLIENT_STATUSES: IlluminareClientStatus[] = [
  "active",
  "onboarding",
  "paused",
  "offboarded",
];

export const ILLUMINARE_ENGAGEMENT_TYPES: IlluminareEngagementType[] = [
  "retainer",
  "project",
  "hybrid",
];

export const ILLUMINARE_CLIENT_COLUMNS =
  "id, account_name, account_lead, status, website, basecamp_project_id, notes, contact_name, contact_email, engagement_type, scope_summary, retainer_notes, goals, strategy, progress_notes, created_at, updated_at";
