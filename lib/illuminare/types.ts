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
  last_communication_at: string | null;
  last_comm_is_internal: boolean | null;
  needs_reply: boolean;
  days_stale: number | null;
  comms_synced_at: string | null;
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
  "id, account_name, account_lead, status, website, basecamp_project_id, notes, contact_name, contact_email, engagement_type, scope_summary, retainer_notes, goals, strategy, progress_notes, last_communication_at, last_comm_is_internal, needs_reply, days_stale, comms_synced_at, created_at, updated_at";
