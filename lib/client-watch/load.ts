import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRosterReport } from "@/lib/basecamp/load-roster-report";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import { shapeRow } from "@/lib/basecamp/response-report";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import {
  CLIENT_WATCH_MIGRATION,
  WATCH_READ_COLUMNS,
  basecampStatusOf,
  countByStrategist,
  isMissingTableError,
  type BasecampStatus,
  type StrategistCounts,
  type WatchRead,
} from "./shape";

/**
 * Client Watch as the page shows it: one row per Master Sheet client with a
 * Package, the Response Report's live status beside the latest read. Read
 * with the signed-in person's own session, so only admins see reads.
 */

export type WatchRow = {
  clientId: number;
  name: string;
  strategist: string;
  basecampStatus: BasecampStatus;
  daysSinceClientPosted: number | null;
  lastClientPost: { at: string; author: string | null; thread: string | null; url: string | null } | null;
  daysSinceWePosted: number | null;
  lastOurPost: { at: string; author: string | null; thread: string | null; url: string | null } | null;
  /** The newest good read, or null when the client hasn't been read yet. */
  read: WatchRead | null;
  /** The newest read, when it failed after the good one (or there is no good one). */
  failedRead: WatchRead | null;
  /** Basecamp has newer posts than the read saw: the next refresh will read it again. */
  readIsBehind: boolean;
};

export type ClientWatchData = {
  rows: WatchRow[];
  counts: StrategistCounts[];
  /** Roster clients that are cancelling or former, left off as on the Response Report. */
  excluded: number;
  lastReadAt: string | null;
  lastSyncedAt: string | null;
  setupError: string | null;
  loadError: string | null;
};

function post(at: string | null, author: string | null, thread: string | null, url: string | null) {
  return at ? { at, author, thread, url } : null;
}

async function loadReads(supabase: SupabaseClient, view: "client_watch_latest" | "client_watch_last_attempt"): Promise<WatchRead[]> {
  return fetchAllRows<WatchRead>(
    (from, to) => supabase.from(view).select(WATCH_READ_COLUMNS).order("client_id").order("id").range(from, to),
    "Client Watch reads",
  );
}

export function toWatchRow(row: ResponseReportRow, read: WatchRead | null, attempt: WatchRead | null): WatchRow {
  const shaped = shapeRow(row);
  const failedRead = attempt?.error && (!read || attempt.id > read.id) ? attempt : null;
  const newest = [row.last_internal_at, row.last_client_at].filter((t): t is string => Boolean(t)).sort().pop() ?? null;
  return {
    clientId: row.client_id!,
    name: row.account_name,
    strategist: row.marketing_strategist?.trim() ?? "",
    basecampStatus: basecampStatusOf(shaped),
    daysSinceClientPosted: row.last_client_at ? row.days_since_client_contact : null,
    lastClientPost: post(row.last_client_at, row.last_client_author, row.last_client_thread_title, row.last_client_thread_url),
    daysSinceWePosted: row.last_internal_at ? row.days_since_our_reply : null,
    lastOurPost: post(row.last_internal_at, row.last_internal_author, row.last_internal_thread_title, row.last_internal_thread_url),
    read,
    failedRead,
    readIsBehind: Boolean(read && newest && (!read.newest_post_at || new Date(newest) > new Date(read.newest_post_at))),
  };
}

export async function loadClientWatch(supabase: SupabaseClient, now = new Date()): Promise<ClientWatchData> {
  const report = await loadRosterReport(supabase);
  const base = { excluded: report.excludedRows.length, lastSyncedAt: report.lastSyncedAt ?? null };
  if (report.loadError || !report.rosterApplied) {
    return {
      ...base,
      rows: [],
      counts: [],
      lastReadAt: null,
      setupError: null,
      loadError: report.loadError ?? `The Master Sheet roster could not be applied: ${report.roster.error ?? "unknown reason"}`,
    };
  }

  let latest: WatchRead[] = [];
  let attempts: WatchRead[] = [];
  let setupError: string | null = null;
  try {
    [latest, attempts] = await Promise.all([loadReads(supabase, "client_watch_latest"), loadReads(supabase, "client_watch_last_attempt")]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isMissingTableError(message)) {
      return { ...base, rows: [], counts: [], lastReadAt: null, setupError: null, loadError: `Could not read Client Watch: ${message}` };
    }
    setupError = `Client Watch isn't set up yet: run ${CLIENT_WATCH_MIGRATION} in Supabase.`;
  }
  const latestBy = new Map(latest.map((r) => [r.client_id, r]));
  const attemptBy = new Map(attempts.map((r) => [r.client_id, r]));

  const seen = new Set<number>();
  const rows: WatchRow[] = [];
  for (const row of report.rows) {
    if (row.client_id == null || seen.has(row.client_id)) continue;
    seen.add(row.client_id);
    rows.push(toWatchRow(row, latestBy.get(row.client_id) ?? null, attemptBy.get(row.client_id) ?? null));
  }
  rows.sort((a, b) => a.strategist.localeCompare(b.strategist) || a.name.localeCompare(b.name));

  const lastReadAt = attempts.map((a) => a.read_at).sort().pop() ?? null;
  return {
    ...base,
    rows,
    counts: countByStrategist(rows, now),
    lastReadAt,
    setupError,
    loadError: null,
  };
}

/** The client page's panel: this client's latest read and Basecamp status. Null for non-admins or when nothing is set up. */
export async function loadClientWatchForClient(
  supabase: SupabaseClient,
  clientId: number,
): Promise<{ read: WatchRead | null; failedRead: WatchRead | null; error: string | null } | null> {
  const [latest, attempt] = await Promise.all([
    supabase.from("client_watch_latest").select(WATCH_READ_COLUMNS).eq("client_id", clientId).maybeSingle<WatchRead>(),
    supabase.from("client_watch_last_attempt").select(WATCH_READ_COLUMNS).eq("client_id", clientId).maybeSingle<WatchRead>(),
  ]);
  const failure = latest.error ?? attempt.error;
  if (failure) {
    if (isMissingTableError(failure.message)) return null;
    return { read: null, failedRead: null, error: `Could not read Client Watch: ${failure.message}` };
  }
  const read = latest.data ?? null;
  const last = attempt.data ?? null;
  return { read, failedRead: last?.error && (!read || last.id > read.id) ? last : null, error: null };
}
