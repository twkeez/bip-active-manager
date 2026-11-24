import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import type { RosterEntry } from "@/lib/basecamp/sheet-roster";

/**
 * Turns the per-project response report into a per-client one, driven by the
 * Master Sheet roster: one row for every roster client that has a Basecamp
 * project, whatever the project list or the ignore list says. Projects no
 * roster client points at are kept apart, never mixed into the counts.
 *
 * Pure, so the page and the Poobah connector can share it.
 */

export type RosterClientFlags = {
  id: number;
  is_low_contact: boolean | null;
  is_website_only: boolean | null;
  reply_acknowledged_for_occurred_at: string | null;
};

export type RosterReport = {
  /** One row per roster client with a Basecamp project. */
  rosterRows: ResponseReportRow[];
  /** Basecamp projects no roster client points at. */
  otherRows: ResponseReportRow[];
};

function blankRow(entry: RosterEntry): ResponseReportRow {
  return {
    basecamp_project_id: entry.projectId!,
    basecamp_project_name: entry.practiceName,
    client_id: entry.clientId,
    account_name: entry.practiceName,
    marketing_strategist: entry.strategist,
    is_low_contact: null,
    is_website_only: null,
    reply_acknowledged_for_occurred_at: null,
    last_internal_at: null,
    last_internal_author: null,
    last_internal_author_email: null,
    last_internal_thread_title: null,
    last_internal_thread_url: null,
    last_client_at: null,
    last_client_author: null,
    last_client_author_email: null,
    last_client_thread_title: null,
    last_client_thread_url: null,
    client_spoke_last: false,
    days_since_our_reply: null,
    days_since_client_contact: null,
    last_activity_at: null,
  };
}

export function applyRoster(
  /** The report's own rows: every tracked project. */
  projectRows: ResponseReportRow[],
  entries: RosterEntry[],
  flags: RosterClientFlags[],
  /** Rows for roster projects the report leaves out because they are on the ignore list. */
  ignoredProjectRows: ResponseReportRow[] = [],
): RosterReport {
  const tracked = new Map(projectRows.map((row) => [row.basecamp_project_id, row]));
  const ignored = new Map(ignoredProjectRows.map((row) => [row.basecamp_project_id, row]));
  const flagsById = new Map(flags.map((flag) => [flag.id, flag]));

  const rosterRows: ResponseReportRow[] = [];
  const claimed = new Set<string>();
  for (const entry of entries) {
    if (entry.state !== "ready" || !entry.projectId || entry.clientId == null) continue;
    claimed.add(entry.projectId);
    const onIgnoreList = !tracked.has(entry.projectId) && ignored.has(entry.projectId);
    const base = tracked.get(entry.projectId) ?? ignored.get(entry.projectId) ?? blankRow(entry);
    const flag = flagsById.get(entry.clientId);
    rosterRows.push({
      ...base,
      // The sheet names the client and its owner; the conversation comes from
      // the project, which two practices may share.
      client_id: entry.clientId,
      account_name: entry.practiceName,
      marketing_strategist: entry.strategist,
      is_low_contact: flag?.is_low_contact ?? null,
      is_website_only: flag?.is_website_only ?? null,
      reply_acknowledged_for_occurred_at: flag?.reply_acknowledged_for_occurred_at ?? null,
      row_key: `client-${entry.clientId}`,
      on_roster: true,
      shares_project_with: entry.sharesProjectWith,
      on_ignore_list: onIgnoreList,
    });
  }

  const otherRows = projectRows
    .filter((row) => !claimed.has(row.basecamp_project_id))
    .map((row) => ({ ...row, row_key: `project-${row.basecamp_project_id}`, on_roster: false }));
  return { rosterRows, otherRows };
}

/** Whole days between two moments, by calendar date (UTC), as the report's view counts them. */
export function daysBetween(earlier: string, now: number): number {
  const day = (ms: number) => Math.floor(ms / 86_400_000);
  return day(now) - day(new Date(earlier).getTime());
}
