import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listBasecampProjectIgnores,
  type BasecampProjectIgnoreRow,
} from "@/lib/clients/basecamp-project-ignores";

// Reads the basecamp_response_report view — one row per Basecamp project
// (ignored ones left out) with the last message from our side and the last
// from theirs, already paired up. The client is an optional label. See supabase/migrations/20260824120000_basecamp_response_report.sql.

export type ResponseReportRow = {
  basecamp_project_id: string;
  basecamp_project_name: string;
  /** Null when no client record claims the project. */
  client_id: number | null;
  /** The client's name, or the project's when no client claims it. */
  account_name: string;
  marketing_strategist: string | null;
  is_low_contact: boolean | null;
  is_website_only: boolean | null;
  reply_acknowledged_for_occurred_at: string | null;
  last_internal_at: string | null;
  last_internal_author: string | null;
  last_internal_author_email: string | null;
  last_internal_thread_title: string | null;
  last_internal_thread_url: string | null;
  last_client_at: string | null;
  last_client_author: string | null;
  last_client_author_email: string | null;
  last_client_thread_title: string | null;
  last_client_thread_url: string | null;
  client_spoke_last: boolean;
  days_since_our_reply: number | null;
  days_since_client_contact: number | null;
};

export type ResponseReportData = {
  rows: ResponseReportRow[];
  /** Projects someone marked as not worth tracking; the view leaves them out. */
  ignored: BasecampProjectIgnoreRow[];
  lastSyncedAt: string | null;
  loadError: string | null;
};

// The view ships as a migration Tom pastes by hand, so an un-run migration is a
// real state to explain rather than a crash. Through the REST API a missing
// view is PGRST205 ("not in the schema cache"); Postgres itself says 42P01.
const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"]);

const MISSING_VIEW_MESSAGE =
  "The basecamp_response_report view does not exist yet. Run supabase/migrations/20260824120000_basecamp_response_report.sql in the Supabase SQL editor, then reload.";

export async function loadResponseReport(
  supabase: SupabaseClient,
): Promise<ResponseReportData> {
  const [report, syncState, ignored] = await Promise.all([
    supabase
      .from("basecamp_response_report")
      .select("*")
      .order("account_name", { ascending: true }),
    supabase
      .from("basecamp_sync_state")
      .select("last_synced_at")
      .eq("id", 1)
      .maybeSingle(),
    listBasecampProjectIgnores(supabase).catch(() => []),
  ]);

  if (report.error) {
    return {
      rows: [],
      ignored: [],
      lastSyncedAt: null,
      loadError:
        MISSING_RELATION_CODES.has(report.error.code)
          ? MISSING_VIEW_MESSAGE
          : report.error.message,
    };
  }

  return {
    rows: (report.data ?? []) as ResponseReportRow[],
    ignored,
    lastSyncedAt: syncState.data?.last_synced_at ?? null,
    loadError: null,
  };
}
