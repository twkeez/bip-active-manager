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
  /**
   * The project's newest Basecamp activity, from the sync's roster
   * (basecamp_projects.last_message_at). Read even beyond the stored history,
   * so a project with no stored messages can say when it was last active.
   */
  last_activity_at?: string | null;
  /** Unique per row. Two roster clients can share one project, so the project id is not enough. */
  row_key?: string;
  /** True for a Master Sheet client with a Package; false for any other project. */
  on_roster?: boolean;
  /** Other roster practices on the same Basecamp project. */
  shares_project_with?: string[];
  /** The project is on the "not tracked" list, but the sheet says to cover this client. */
  on_ignore_list?: boolean;
  /** "cancelling" or "former" on a roster client left off the report; who marked it and when. */
  account_status?: "active" | "cancelling" | "former";
  account_status_changed_at?: string | null;
  account_status_changed_by?: string | null;
  /** When the sync last saw this project in Basecamp's own list. Old means archived or gone. */
  project_last_seen_at?: string | null;
  /** Set when this row's Basecamp data could not be read or cannot be trusted; says why. */
  read_problem?: string | null;
};

export type ResponseReportData = {
  rows: ResponseReportRow[];
  /** Projects someone marked as not worth tracking; the view leaves them out. */
  ignored: BasecampProjectIgnoreRow[];
  lastSyncedAt: string | null;
  /** What the last sync said went wrong, as it wrote it. */
  lastSyncError: string | null;
  /** Parts of the report that could not be loaded, or may be cut short. Never swallowed. */
  loadWarnings: string[];
  loadError: string | null;
};

/** The database returns at most this many rows per request without saying so. */
export const ROW_CAP = 1000;

// The view ships as a migration Tom pastes by hand, so an un-run migration is a
// real state to explain rather than a crash. Through the REST API a missing
// view is PGRST205 ("not in the schema cache"); Postgres itself says 42P01.
const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"]);

const MISSING_VIEW_MESSAGE =
  "The basecamp_response_report view does not exist yet. Run supabase/migrations/20260824120000_basecamp_response_report.sql in the Supabase SQL editor, then reload.";

export async function loadResponseReport(
  supabase: SupabaseClient,
): Promise<ResponseReportData> {
  const [report, syncState, ignored, activity] = await Promise.all([
    supabase
      .from("basecamp_response_report")
      .select("*")
      .order("account_name", { ascending: true }),
    supabase
      .from("basecamp_sync_state")
      .select("last_synced_at,last_error")
      .eq("id", 1)
      .maybeSingle(),
    listBasecampProjectIgnores(supabase).then(
      (rows) => ({ rows, error: null as string | null }),
      (error: Error) => ({ rows: [] as BasecampProjectIgnoreRow[], error: error.message }),
    ),
    supabase.from("basecamp_projects").select("basecamp_project_id, last_message_at, last_seen_at"),
  ]);
  type ProjectRow = { basecamp_project_id: string; last_message_at: string | null; last_seen_at: string | null };
  const projects = new Map(((activity.data ?? []) as ProjectRow[]).map((row) => [row.basecamp_project_id, row]));

  const loadWarnings: string[] = [];
  if (ignored.error) loadWarnings.push(`The Not tracked list could not be read (${ignored.error}), so it shows as empty here.`);
  if (activity.error) {
    loadWarnings.push(`The Basecamp project list could not be read (${activity.error}), so "last active" dates and archived-project checks are missing.`);
  }
  if (syncState.error) loadWarnings.push(`The sync's status could not be read (${syncState.error}).`);
  if ((report.data ?? []).length >= ROW_CAP) {
    loadWarnings.push(`The report hit the database's ${ROW_CAP}-row limit, so some Basecamp projects are missing.`);
  }
  if ((activity.data ?? []).length >= ROW_CAP) {
    loadWarnings.push(`The Basecamp project list hit the database's ${ROW_CAP}-row limit, so some "last active" dates are missing.`);
  }

  if (report.error) {
    return {
      rows: [],
      ignored: [],
      lastSyncedAt: null,
      lastSyncError: null,
      loadWarnings,
      loadError:
        MISSING_RELATION_CODES.has(report.error.code)
          ? MISSING_VIEW_MESSAGE
          : report.error.message,
    };
  }

  return {
    rows: ((report.data ?? []) as ResponseReportRow[]).map((row) => ({
      ...row,
      last_activity_at: projects.get(row.basecamp_project_id)?.last_message_at ?? null,
      project_last_seen_at: projects.get(row.basecamp_project_id)?.last_seen_at ?? null,
    })),
    ignored: ignored.rows,
    lastSyncedAt: syncState.data?.last_synced_at ?? null,
    lastSyncError: (syncState.data as { last_error?: string | null } | null)?.last_error ?? null,
    loadWarnings,
    loadError: null,
  };
}
