import type { CadenceMonths } from "@/lib/site-audit/seo-audit-schedule";
import type { SeoAuditTemplateData } from "@/lib/site-audit/seo-audit-template";

export type ClientSeoAuditStatus = "in_progress" | "draft" | "completed";

export type ClientSeoAuditSchedule = {
  id: number;
  client_id: number;
  owner_user_id: string;
  cadence_months: CadenceMonths;
  last_completed_at: string | null;
  next_due_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientSeoAudit = {
  id: number;
  client_id: number;
  owner_user_id: string;
  audit_run_id: number | null;
  status: ClientSeoAuditStatus;
  audit_date: string;
  prepared_by: string | null;
  package_tier: string | null;
  template_json: SeoAuditTemplateData;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A schedule row joined with the client name + assigned strategist, for the
 *  dashboard "due" surface and the audits overview. */
export type ClientSeoAuditScheduleWithClient = ClientSeoAuditSchedule & {
  account_name: string;
  marketing_strategist: string | null;
  website: string | null;
};

/** An audit row joined with its client's display name. */
export type ClientSeoAuditWithClient = ClientSeoAudit & {
  account_name: string;
};
