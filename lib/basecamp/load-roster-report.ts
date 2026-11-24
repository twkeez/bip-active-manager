import type { SupabaseClient } from "@supabase/supabase-js";
import { loadResponseReport, type ResponseReportData, type ResponseReportRow } from "@/lib/basecamp/load-response-report";
import { applyRoster, daysBetween, type RosterClientFlags } from "@/lib/basecamp/roster-report";
import { loadSheetRoster, type LoadedSheetRoster } from "@/lib/basecamp/sheet-roster";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";

/**
 * The Response Report as the page shows it: one row per Master Sheet client
 * with a Package, and every other Basecamp project kept apart.
 *
 * If the roster cannot be read, the report falls back to every project (as it
 * was before the roster) and says so. It never shows an empty or shortened
 * list as though it were the roster.
 */

export type RosterReportData = ResponseReportData & {
  /** Projects no roster client points at. Empty when the roster was not applied. */
  otherRows: ResponseReportRow[];
  roster: LoadedSheetRoster;
  /** False when the roster could not be read and `rows` is every project instead. */
  rosterApplied: boolean;
};

type EventRow = {
  occurred_at: string;
  author_email: string | null;
  author_name: string | null;
  thread_title: string | null;
  thread_url: string | null;
};

/** The report's row for a project its view leaves out (one on the ignore list). */
async function loadProjectRow(supabase: SupabaseClient, projectId: string, name: string): Promise<ResponseReportRow> {
  const latest = async (internal: boolean) => {
    const { data, error } = await supabase
      .from("basecamp_communication_events")
      .select("occurred_at,author_email,author_name,thread_title,thread_url")
      .eq("basecamp_project_id", projectId)
      .eq("is_internal", internal)
      .order("occurred_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Could not read the Basecamp posts of ${name}: ${error.message}`);
    return ((data ?? [])[0] as EventRow | undefined) ?? null;
  };
  const [ours, theirs] = await Promise.all([latest(true), latest(false)]);
  const now = Date.now();
  return {
    basecamp_project_id: projectId,
    basecamp_project_name: name,
    client_id: null,
    account_name: name,
    marketing_strategist: null,
    is_low_contact: null,
    is_website_only: null,
    reply_acknowledged_for_occurred_at: null,
    last_internal_at: ours?.occurred_at ?? null,
    last_internal_author: ours ? (ours.author_name ?? ours.author_email) : null,
    last_internal_author_email: ours?.author_email ?? null,
    last_internal_thread_title: ours?.thread_title ?? null,
    last_internal_thread_url: ours?.thread_url ?? null,
    last_client_at: theirs?.occurred_at ?? null,
    last_client_author: theirs ? (theirs.author_name ?? theirs.author_email) : null,
    last_client_author_email: theirs?.author_email ?? null,
    last_client_thread_title: theirs?.thread_title ?? null,
    last_client_thread_url: theirs?.thread_url ?? null,
    client_spoke_last: !!theirs && (!ours || theirs.occurred_at > ours.occurred_at),
    days_since_our_reply: ours ? daysBetween(ours.occurred_at, now) : null,
    days_since_client_contact: theirs ? daysBetween(theirs.occurred_at, now) : null,
    last_activity_at: null,
  };
}

export async function loadRosterReport(supabase: SupabaseClient): Promise<RosterReportData> {
  const [report, roster] = await Promise.all([loadResponseReport(supabase), loadSheetRoster(supabase)]);
  const unapplied = (rosterError: string | null): RosterReportData => ({
    ...report,
    otherRows: [],
    roster: rosterError ? { ...roster, error: rosterError } : roster,
    rosterApplied: false,
  });
  if (report.loadError || roster.error) return unapplied(null);

  const ready = roster.entries.filter((entry) => entry.state === "ready");
  try {
    const clientIds = ready.map((entry) => entry.clientId!);
    const flags = await fetchAllRows<RosterClientFlags>(
      (from, to) =>
        supabase
          .from("clients")
          .select("id,is_low_contact,is_website_only,reply_acknowledged_for_occurred_at")
          .in("id", clientIds)
          .order("id")
          .range(from, to),
      "roster clients",
    );

    // The sheet outranks the ignore list: a roster client whose project was
    // marked "not tracked" is still reported, read straight from its posts.
    const ignoredIds = new Set(report.ignored.map((row) => row.basecamp_project_id));
    const needed = new Map<string, string>();
    for (const entry of ready) if (ignoredIds.has(entry.projectId!)) needed.set(entry.projectId!, entry.practiceName);
    const ignoredRows = await Promise.all(
      [...needed].map(([projectId, name]) => loadProjectRow(supabase, projectId, name)),
    );

    const { rosterRows, otherRows } = applyRoster(report.rows, roster.entries, flags, ignoredRows);
    return { ...report, rows: rosterRows, otherRows, roster, rosterApplied: true };
  } catch (error) {
    return unapplied(
      `${(error as Error).message}. Showing every Basecamp project instead of the roster until this is fixed.`,
    );
  }
}
