import type { SupabaseClient } from "@supabase/supabase-js";
import { HISTORY_DAYS, loadRosterReport } from "@/lib/basecamp/load-roster-report";
import {
  HEARD_THRESHOLDS,
  isDismissed,
  reportTiles,
  shapeAndSort,
  summarizeReport,
  type ShapedReportRow,
} from "@/lib/basecamp/response-report";
import { loadSheetRoster, type RosterEntry } from "@/lib/basecamp/sheet-roster";
import { ACCOUNT_STATUS_LABEL, accountStatusOf } from "@/lib/clients/account-status";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { resolveWatch } from "./store";
import { PoobahError } from "./validate";

/**
 * The Master Sheet roster for Claude, through the connector: any client on the
 * sheet with a Package can be read, watched or not, and the Response Report
 * comes back whole, with what was checked and what could not be.
 */

export type ResolvedClient = {
  clientId: number;
  name: string;
  /** True when the client is on the Poobah watch list. */
  watched: boolean;
  /** The client's Master Sheet row, or null when it is watched but not on the roster. */
  roster: RosterEntry | null;
};

export function describeRosterEntry(entry: RosterEntry | null) {
  if (!entry) return { on_master_sheet_roster: false, note: "Not on the Master Sheet with a Package (or not matched to it)." };
  return {
    on_master_sheet_roster: true,
    practice: entry.practiceName,
    strategist: entry.strategist,
    package: entry.packageValue,
    shares_basecamp_project_with: entry.sharesProjectWith,
  };
}

/** Roster entries a name points at: exact first, then names that contain the words given. */
export function findRosterEntry(entries: RosterEntry[], text: string): RosterEntry[] {
  const wanted = normalizeClientName(text);
  if (!wanted) return [];
  const names = (entry: RosterEntry) => [entry.practiceName, entry.clientName ?? ""].map(normalizeClientName);
  const exact = entries.filter((entry) => names(entry).includes(wanted));
  return exact.length ? exact : entries.filter((entry) => names(entry).some((name) => name.includes(wanted)));
}

/**
 * A client for a read: on the watch list (by watch id or name), or anywhere on
 * the Master Sheet roster (by name, or by its BIP Control client id).
 */
export async function resolveClientForRead(
  admin: SupabaseClient,
  ref: { client?: string | number; bipClientId?: number },
): Promise<ResolvedClient> {
  const roster = await loadSheetRoster(admin);
  const entryFor = (clientId: number) => roster.entries.find((entry) => entry.clientId === clientId) ?? null;
  const usable = (entry: RosterEntry): ResolvedClient => {
    if (entry.state !== "ready" || entry.clientId == null) {
      throw new PoobahError(
        `${entry.practiceName} is on the Master Sheet but ${
          entry.state === "no_project" ? "its client has no Basecamp project linked" : "is not matched to a BIP Control client"
        }, so there is no Basecamp to read. It is listed at the top of the Response Report.`,
        404,
      );
    }
    return { clientId: entry.clientId, name: entry.practiceName, watched: false, roster: entry };
  };

  if (ref.bipClientId != null) {
    if (roster.error) throw new PoobahError(`The Master Sheet roster could not be read: ${roster.error}`, 500);
    const entry = entryFor(ref.bipClientId);
    if (!entry) {
      throw new PoobahError(
        `BIP Control client ${ref.bipClientId} is not on the Master Sheet roster. Use get_response_report to see who is.`,
        404,
      );
    }
    return usable(entry);
  }
  if (ref.client == null || ref.client === "") throw new PoobahError("Say which client: a name, a watch id, or bip_client_id.");

  // The watch list first, so everything that worked before works the same.
  try {
    const watch = await resolveWatch(admin, ref.client);
    if (watch.client_id) return { clientId: watch.client_id, name: watch.name, watched: true, roster: entryFor(watch.client_id) };
    throw new PoobahError(`${watch.name} is not linked to a BIP Control client, so it has no synced Basecamp project.`, 404);
  } catch (error) {
    const notWatched = error instanceof PoobahError && /is not on the watch list/.test(error.message);
    // A number is a watch id, and an ambiguous name is still ambiguous: only
    // "no such name on the watch list" falls through to the roster.
    if (!notWatched) throw error;
  }

  if (roster.error) throw new PoobahError(`The Master Sheet roster could not be read: ${roster.error}`, 500);
  const text = String(ref.client).trim();
  const matches = findRosterEntry(roster.entries, text);
  if (matches.length === 1) return usable(matches[0]!);
  if (!matches.length) {
    throw new PoobahError(
      `"${text}" is not on the watch list or the Master Sheet roster (${roster.counts.inScope} clients with a Package). Use get_response_report to see every roster client.`,
      404,
    );
  }
  throw new PoobahError(
    `"${text}" matches ${matches.length} roster clients: ${matches
      .map((entry) => `${entry.practiceName}${entry.clientId != null ? ` (bip_client_id ${entry.clientId})` : ""}`)
      .join(", ")}. Pass bip_client_id.`,
    409,
  );
}

function post(at: string | null, author: string | null, thread: string | null, url: string | null) {
  return at ? { at, author, thread, url } : null;
}

export function clientLine(row: ShapedReportRow) {
  const waitingOnUs = row.status === "awaiting_us" && !isDismissed(row);
  return {
    practice: row.account_name,
    bip_client_id: row.client_id,
    strategist: row.marketing_strategist,
    low_contact: row.is_low_contact === true,
    flags: [...(waitingOnUs ? ["waiting on us"] : []), ...(row.notHeard ? ["haven't heard from us"] : [])],
    who_spoke_last:
      row.status === "no_contact" ? `nobody in the last ${HISTORY_DAYS} days` : row.client_spoke_last ? "the client" : "Beyond Indigo",
    client_message_dismissed_as_needing_no_reply: isDismissed(row),
    days_since_client_last_post: row.last_client_at ? row.days_since_client_contact : null,
    days_since_our_last_post: row.quietDays,
    not_heard_limit_days: row.heardLimitDays,
    not_heard_limit_reason:
      row.relaxedReason === "low_contact" ? "low contact" : row.relaxedReason === "alex" ? "Strategist is Alex" : "standard",
    last_client_post: post(row.last_client_at, row.last_client_author, row.last_client_thread_title, row.last_client_thread_url),
    last_our_post: post(row.last_internal_at, row.last_internal_author, row.last_internal_thread_title, row.last_internal_thread_url),
    shares_basecamp_project_with: row.shares_project_with ?? [],
    could_not_be_read: row.read_problem ?? null,
  };
}

export type ReportFilter = { only?: "all" | "flagged"; strategist?: string };

/** The Response Report, as the page shows it, for Claude. */
export async function loadResponseReportForClaude(admin: SupabaseClient, filter: ReportFilter = {}) {
  const report = await loadRosterReport(admin);
  // Never a shortened or roster-less report passed off as the real one.
  if (report.loadError) throw new PoobahError(`The Response Report could not be read: ${report.loadError}`, 500);
  if (!report.rosterApplied || !report.integrity) {
    throw new PoobahError(
      `The Master Sheet roster could not be applied, so there is no roster report to give: ${report.roster.error ?? "unknown reason"}`,
      500,
    );
  }

  const shaped = shapeAndSort(report.rows);
  const tiles = reportTiles(shaped);
  const summary = summarizeReport(shaped);
  const strategist = filter.strategist?.trim().toLowerCase() ?? "";
  const shown = shaped.filter((row) => {
    if (strategist && !(row.marketing_strategist ?? "").toLowerCase().includes(strategist)) return false;
    if (filter.only === "flagged") return row.notHeard || (row.status === "awaiting_us" && !isDismissed(row));
    return true;
  });
  const { integrity } = report;
  const filters = [
    filter.only === "flagged" ? "flagged only" : null,
    strategist ? `strategist contains "${filter.strategist!.trim()}"` : null,
  ].filter(Boolean);

  return {
    complete: integrity.complete,
    checked: `${integrity.inScope} of ${integrity.inScope} Master Sheet clients with a Package: ${integrity.reported} reported, ${integrity.failed.length} could not be read, ${integrity.excluded} excluded as cancelling or former, ${integrity.notMatched.length} not matched to a client.`,
    shown: `${shown.length} of ${shaped.length} reported clients listed below${filters.length ? ` (filter: ${filters.join(", ")})` : ""}. The counts cover all ${shaped.length}.`,
    integrity: {
      could_not_be_read: integrity.failed,
      not_matched: integrity.notMatched,
      problems: integrity.problems,
      limits: integrity.limits,
      roster_warnings: report.roster.warnings,
      wiring_to_fix: report.roster.sharedProjects
        .filter((project) => project.kind === "problem")
        .map((project) => ({
          basecamp_project_id: project.projectId,
          clients: project.claimants.map((c) => `${c.clientName} (#${c.clientId})`),
        })),
      strategist_missing_on_sheet: report.roster.needsStrategist,
    },
    rules: {
      waiting_on_us: "The client posted last (and nobody dismissed that message as needing no reply).",
      havent_heard_from_us: `We spoke last, or not at all, and our last post is ${HEARD_THRESHOLDS.standardDays}+ days old; ${HEARD_THRESHOLDS.relaxedDays}+ for low-contact clients and clients whose Strategist is exactly "Alex". A client waiting on us is not also flagged here.`,
    },
    sheet_read_at: report.roster.sheetReadAt,
    basecamp_last_synced_at: report.lastSyncedAt,
    counts: {
      reported: shaped.length,
      waiting_on_us: tiles.waitingOnUs,
      havent_heard_from_us: tiles.notHeard,
      waiting_on_client: summary.awaitingClient,
      no_activity: summary.noContact,
    },
    clients: shown.map(clientLine),
    excluded: report.excludedRows.map((row) => ({
      practice: row.account_name,
      bip_client_id: row.client_id,
      status: ACCOUNT_STATUS_LABEL[accountStatusOf(row.account_status)],
      marked_by: row.account_status_changed_by ?? null,
      marked_at: row.account_status_changed_at ?? null,
    })),
    other_basecamp_projects_not_counted: report.otherRows.length,
  };
}
