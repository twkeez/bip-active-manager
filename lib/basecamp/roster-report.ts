import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import type { RosterEntry } from "@/lib/basecamp/sheet-roster";
import { accountStatusOf } from "@/lib/clients/account-status";

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
  /** Missing when the status column has not been added yet; read as active. */
  account_status?: string | null;
  account_status_changed_at?: string | null;
  account_status_changed_by?: string | null;
};

export type RosterReport = {
  /** One row per roster client with a Basecamp project. */
  rosterRows: ResponseReportRow[];
  /** Roster clients marked cancelling or former: off the report, but counted and listed. */
  excludedRows: ResponseReportRow[];
  /** Basecamp projects no roster client points at. */
  otherRows: ResponseReportRow[];
};

function blankRow(entry: RosterEntry): ResponseReportRow {
  return {
    read_problem: "Its Basecamp project is not in the list the sync reads, so none of its posts are stored.",
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
  const excludedRows: ResponseReportRow[] = [];
  const claimed = new Set<string>();
  for (const entry of entries) {
    if (entry.state !== "ready" || !entry.projectId || entry.clientId == null) continue;
    claimed.add(entry.projectId);
    const onIgnoreList = !tracked.has(entry.projectId) && ignored.has(entry.projectId);
    const base = tracked.get(entry.projectId) ?? ignored.get(entry.projectId) ?? blankRow(entry);
    const flag = flagsById.get(entry.clientId);
    const accountStatus = accountStatusOf(flag?.account_status);
    (accountStatus === "active" ? rosterRows : excludedRows).push({
      ...base,
      account_status: accountStatus,
      account_status_changed_at: flag?.account_status_changed_at ?? null,
      account_status_changed_by: flag?.account_status_changed_by ?? null,
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
  return { rosterRows, excludedRows, otherRows };
}

/** Whole days between two moments, by calendar date (UTC), as the report's view counts them. */
export function daysBetween(earlier: string, now: number): number {
  const day = (ms: number) => Math.floor(ms / 86_400_000);
  return day(now) - day(new Date(earlier).getTime());
}

// --- Integrity: what was checked, and what could not be -------------------

/** A project Basecamp has not listed for this long is archived or gone. */
export const PROJECT_GONE_AFTER_HOURS = 48;

/** Project ids the last sync said it failed on, with its reason, read from the sync's own error text. */
export function failedSyncProjects(lastSyncError: string | null): Map<string, string> {
  const failed = new Map<string, string>();
  if (!lastSyncError) return failed;
  for (const match of lastSyncError.matchAll(/project (\d+) \(client [^)]*\): ([^;|]*)/g)) {
    const reason = match[2]!.trim();
    // Older runs filed a shared project under failures; it never was one.
    if (/^Duplicate basecamp_project_id/.test(reason)) continue;
    failed.set(match[1]!, reason);
  }
  return failed;
}

/** Why a row's Basecamp data cannot be trusted, or null when it can. */
export function readProblemOf(
  row: ResponseReportRow,
  context: { failedProjects: Map<string, string>; now: number },
): string | null {
  if (row.read_problem) return row.read_problem;
  const failure = context.failedProjects.get(row.basecamp_project_id);
  if (failure) return `The last Basecamp sync failed on this project: ${failure}`;
  if (row.project_last_seen_at) {
    const hours = (context.now - new Date(row.project_last_seen_at).getTime()) / 3_600_000;
    if (hours > PROJECT_GONE_AFTER_HOURS) {
      return `Basecamp has not listed this project since ${row.project_last_seen_at.slice(0, 10)}, so it is probably archived${
        row.on_roster ? " and the client may be wired to the wrong project" : ""
      }.`;
    }
  }
  return null;
}

export type ReportIntegrity = {
  /** Master Sheet clients with a Package: the number the report answers for. */
  inScope: number;
  /** On the report with data that can be trusted. */
  reported: number;
  /** On the report, but their Basecamp data could not be read or cannot be trusted. */
  failed: Array<{ name: string; reason: string }>;
  /** Marked cancelling or former. */
  excluded: number;
  /** Not matched to a client with a Basecamp project. */
  notMatched: string[];
  /** Things that limit the whole report: a stale sync, a row cap, a list that would not load. */
  problems: string[];
  /** Fixed limits, always stated. */
  limits: string[];
  /** True when every roster client is reported and nothing above is wrong. */
  complete: boolean;
};

export function buildIntegrity(input: {
  entries: RosterEntry[];
  rosterRows: ResponseReportRow[];
  excludedRows: ResponseReportRow[];
  problems: string[];
  historyDays: number;
}): ReportIntegrity {
  const failed = input.rosterRows
    .filter((row) => row.read_problem)
    .map((row) => ({ name: row.account_name, reason: row.read_problem! }));
  const notMatched = input.entries.filter((entry) => entry.state !== "ready").map((entry) => entry.practiceName);
  return {
    inScope: input.entries.length,
    reported: input.rosterRows.length - failed.length,
    failed,
    excluded: input.excludedRows.length,
    notMatched,
    problems: input.problems,
    limits: [
      `Basecamp history goes back about ${input.historyDays} days; anything older reads as no activity.`,
      "Only Basecamp is read. Email, phone calls and meetings are not counted as contact.",
    ],
    complete: failed.length === 0 && notMatched.length === 0 && input.problems.length === 0,
  };
}
