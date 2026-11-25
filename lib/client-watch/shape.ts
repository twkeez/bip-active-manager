import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import { isDismissed, shapeRow, type ShapedReportRow } from "@/lib/basecamp/response-report";

/**
 * Client Watch: where each Master Sheet client stands (Tom, Nov 25 2026).
 *
 * Two kinds of facts sit side by side on each row, and they never mix:
 *   - From the data, worked out every time the page loads: the Basecamp
 *     status (waiting on us, haven't heard from us…) and days since each side
 *     posted. These come from the Response Report, so they always agree with it.
 *   - From a read: Claude going through the client's Basecamp threads and
 *     writing down what we owe, where things stand, open asks, our
 *     commitments, the latest report seen, flags and a next action. A read is
 *     dated, and is redone only when the client has new Basecamp posts.
 *
 * Pure functions only; reading and writing are in read.ts, run.ts and load.ts.
 * Home shows it (components/home/client-watch-section.tsx).
 */

/** The group for a client whose Strategist cell on the Master Sheet is empty. */
export const NO_STRATEGIST_ON_SHEET = "No strategist on the sheet";

/** Change this when the instructions change: every client is then read again. */
export const CLIENT_WATCH_PROMPT_VERSION = "2026-11-25.1";

/** How far back a read looks, and how far when that holds no posts at all. */
export const READ_WINDOW_DAYS = 90;
export const QUIET_WINDOW_DAYS = 180;

export type OweResponse = "yes" | "no" | "thanks_only";

export const OWE_LABEL: Record<OweResponse, string> = {
  yes: "Yes",
  no: "No",
  thanks_only: "Client spoke last, thanks only",
};

/** One read as stored in client_watch_reads. */
export type WatchRead = {
  id: number;
  client_id: number;
  read_at: string;
  prompt_version: string;
  model: string;
  window_days: number;
  threads_read: number;
  posts_read: number;
  posts_without_words: number;
  newest_post_at: string | null;
  cost_usd: number | null;
  owe_response: OweResponse | null;
  what_we_owe: string | null;
  where_things_stand: string | null;
  open_asks: string | null;
  our_commitments: string | null;
  other_threads: string | null;
  latest_report_month: string | null;
  next_action: string | null;
  flags: string[];
  unhappy: boolean;
  most_recent_thread: string | null;
  read_notes: string | null;
  error: string | null;
};

export const WATCH_READ_COLUMNS =
  "id,client_id,read_at,prompt_version,model,window_days,threads_read,posts_read,posts_without_words,newest_post_at,cost_usd,owe_response,what_we_owe,where_things_stand,open_asks,our_commitments,other_threads,latest_report_month,next_action,flags,unhappy,most_recent_thread,read_notes,error";

export const CLIENT_WATCH_MIGRATION = "supabase/migrations/20261125220000_client_watch_reads.sql";

/** True when an error means the Client Watch table hasn't been created yet. */
export function isMissingTableError(message: string): boolean {
  return /client_watch_(reads|latest|last_attempt)/.test(message) && /does not exist|schema cache|not find/i.test(message);
}

// --- Basecamp status, from the Response Report ------------------------------

export type BasecampStatus = "waiting_on_us" | "not_heard" | "waiting_on_client" | "no_activity";

export const BASECAMP_STATUS_LABEL: Record<BasecampStatus, string> = {
  waiting_on_us: "Waiting on us",
  not_heard: "Haven't heard from us",
  waiting_on_client: "Waiting on client",
  no_activity: "No activity",
};

/**
 * The Response Report's own headings, one per client: waiting on us comes
 * first (a message marked "no reply needed" doesn't count), then haven't
 * heard from us, then who spoke last.
 */
export function basecampStatusOf(row: ShapedReportRow): BasecampStatus {
  if (row.status === "awaiting_us" && !isDismissed(row)) return "waiting_on_us";
  if (row.notHeard) return "not_heard";
  if (row.status === "no_contact") return "no_activity";
  return "waiting_on_client";
}

/** The newest Basecamp post on the client's project, from either side. */
export function newestActivityOf(row: Pick<ResponseReportRow, "last_internal_at" | "last_client_at">): string | null {
  const times = [row.last_internal_at, row.last_client_at].filter((t): t is string => Boolean(t));
  if (!times.length) return null;
  return times.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

// --- Report behind -----------------------------------------------------------

/**
 * A monthly report is behind when the latest one seen in Basecamp covers a
 * month more than two months back. As of any day in November, August or
 * earlier is behind and September or October is not (the rule the status
 * sheet used on Nov 25). No report seen at all is not called behind: not
 * every client gets a report in Basecamp.
 */
export function isReportBehind(latestReportMonth: string | null, now: Date): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(latestReportMonth ?? "");
  if (!match) return false;
  const seen = Number(match[1]) * 12 + (Number(match[2]) - 1);
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return seen < current - 2;
}

/** "2026-08" → "August 2026". */
export function reportMonthLabel(latestReportMonth: string | null): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(latestReportMonth ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// --- Which clients to read ---------------------------------------------------

export type ReadReason = "never read" | "new Basecamp posts" | "last read failed" | "instructions or model changed" | "asked for";

export type PlanInput = {
  /** Roster clients: one entry per client id. */
  clients: Array<{ clientId: number; name: string; newestPostAt: string | null }>;
  /** The newest read of any kind per client. */
  lastAttempts: Map<number, Pick<WatchRead, "newest_post_at" | "prompt_version" | "model" | "error">>;
  model: string;
  promptVersion: string;
  /** Read these whatever their state (the Re-read button). */
  force?: Set<number>;
};

export type PlannedRead = { clientId: number; name: string; newestPostAt: string | null; reason: ReadReason };

/**
 * A client is read again only when something changed: it has never been
 * read, a newer Basecamp post has come in, the last read failed, or the
 * instructions or model changed. Everything else keeps its last read, so a
 * quiet day costs nothing. Never-read clients go first, then the most
 * recently active.
 */
export function planReads(input: PlanInput): { due: PlannedRead[]; unchanged: number } {
  const due: PlannedRead[] = [];
  let unchanged = 0;
  for (const client of input.clients) {
    const last = input.lastAttempts.get(client.clientId);
    let reason: ReadReason | null = null;
    if (input.force?.has(client.clientId)) reason = "asked for";
    else if (!last) reason = "never read";
    else if (last.error) reason = "last read failed";
    else if (last.prompt_version !== input.promptVersion || last.model !== input.model) reason = "instructions or model changed";
    else if (client.newestPostAt && (!last.newest_post_at || new Date(client.newestPostAt) > new Date(last.newest_post_at))) {
      reason = "new Basecamp posts";
    }
    if (reason) due.push({ ...client, reason });
    else unchanged += 1;
  }
  const time = (value: string | null) => (value ? new Date(value).getTime() : 0);
  due.sort(
    (a, b) =>
      Number(b.reason === "never read") - Number(a.reason === "never read") ||
      time(b.newestPostAt) - time(a.newestPostAt) ||
      a.clientId - b.clientId,
  );
  return { due, unchanged };
}

// --- Counts by strategist ----------------------------------------------------

export type WatchRowForCounts = {
  strategist: string;
  basecampStatus: BasecampStatus;
  read: Pick<WatchRead, "owe_response" | "unhappy" | "latest_report_month"> | null;
};

export type StrategistCounts = {
  strategist: string;
  clients: number;
  oweResponse: number;
  thanksOnly: number;
  waitingOnUs: number;
  notHeard: number;
  reportBehind: number;
  unhappy: number;
  notRead: number;
};

/** The status sheet's "By strategist" tab, with a total row last. Strategist names are as the Master Sheet has them. */
export function countByStrategist(rows: WatchRowForCounts[], now: Date): StrategistCounts[] {
  // Kept the same as Home's "By strategist" lines so the two can sit in one table.
  const blank = (strategist: string): StrategistCounts => ({
    strategist,
    clients: 0,
    oweResponse: 0,
    thanksOnly: 0,
    waitingOnUs: 0,
    notHeard: 0,
    reportBehind: 0,
    unhappy: 0,
    notRead: 0,
  });
  const by = new Map<string, StrategistCounts>();
  const total = blank("Total");
  for (const row of rows) {
    const name = row.strategist.trim() || NO_STRATEGIST_ON_SHEET;
    const entry = by.get(name) ?? blank(name);
    for (const counts of [entry, total]) {
      counts.clients += 1;
      if (row.basecampStatus === "waiting_on_us") counts.waitingOnUs += 1;
      if (row.basecampStatus === "not_heard") counts.notHeard += 1;
      if (!row.read) {
        counts.notRead += 1;
        continue;
      }
      if (row.read.owe_response === "yes") counts.oweResponse += 1;
      if (row.read.owe_response === "thanks_only") counts.thanksOnly += 1;
      if (row.read.unhappy) counts.unhappy += 1;
      if (isReportBehind(row.read.latest_report_month, now)) counts.reportBehind += 1;
    }
    by.set(name, entry);
  }
  return [...[...by.values()].sort((a, b) => a.strategist.localeCompare(b.strategist)), total];
}

// --- One row per client, as Home shows it ------------------------------------


export type PostRef = { at: string; author: string | null; thread: string | null; url: string | null };

export type WatchRow = {
  clientId: number;
  name: string;
  /** As the Master Sheet's Strategist column has it. */
  strategist: string;
  basecampStatus: BasecampStatus;
  /** Days a client message has waited on us; null unless waiting on us. */
  waitingDays: number | null;
  lastClientPost: PostRef | null;
  lastOurPost: PostRef | null;
  /** The newest good read, or null when the client hasn't been read yet. */
  read: WatchRead | null;
  /** The newest read, when it failed after the good one (or there is no good one). */
  failedRead: WatchRead | null;
  /** Basecamp has newer posts than the read saw, so the next refresh reads it again. */
  readIsBehind: boolean;
};

function post(at: string | null, author: string | null, thread: string | null, url: string | null): PostRef | null {
  return at ? { at, author, thread, url } : null;
}

/** A Response Report row and its reads, as one Client Watch row. */
export function toWatchRow(
  row: ResponseReportRow,
  strategist: string | null,
  read: WatchRead | null,
  attempt: WatchRead | null,
): WatchRow {
  const shaped = shapeRow(row);
  const status = basecampStatusOf(shaped);
  const failedRead = attempt?.error && (!read || attempt.id > read.id) ? attempt : null;
  const newest = newestActivityOf(row);
  return {
    clientId: row.client_id!,
    name: row.account_name,
    strategist: strategist?.trim() || NO_STRATEGIST_ON_SHEET,
    basecampStatus: status,
    waitingDays: status === "waiting_on_us" ? shaped.waitingDays : null,
    lastClientPost: post(row.last_client_at, row.last_client_author, row.last_client_thread_title, row.last_client_thread_url),
    lastOurPost: post(row.last_internal_at, row.last_internal_author, row.last_internal_thread_title, row.last_internal_thread_url),
    read,
    failedRead,
    readIsBehind: Boolean(read && newest && (!read.newest_post_at || new Date(newest) > new Date(read.newest_post_at))),
  };
}

/** How pressing a row is: owe a reply, then unhappy, then waiting on us, then a failed or missing read. Lower first. */
function urgency(row: WatchRow): number {
  if (row.read?.owe_response === "yes") return 0;
  if (row.read?.unhappy) return 1;
  if (row.basecampStatus === "waiting_on_us") return 2;
  if (row.basecampStatus === "not_heard") return 3;
  if (row.failedRead || !row.read) return 4;
  return 5;
}

export type WatchGroup = { strategist: string; rows: WatchRow[] };

/**
 * Rows grouped by the sheet's Strategist, strategists A to Z with no
 * strategist last; inside a group the most pressing first, then longest
 * waiting, then by name.
 */
export function groupByStrategist(rows: WatchRow[]): WatchGroup[] {
  const groups = new Map<string, WatchRow[]>();
  for (const row of rows) groups.set(row.strategist, [...(groups.get(row.strategist) ?? []), row]);
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_STRATEGIST_ON_SHEET ? 1 : b === NO_STRATEGIST_ON_SHEET ? -1 : a.localeCompare(b)))
    .map(([strategist, list]) => ({
      strategist,
      rows: [...list].sort(
        (a, b) =>
          urgency(a) - urgency(b) || (b.waitingDays ?? -1) - (a.waitingDays ?? -1) || a.name.localeCompare(b.name),
      ),
    }));
}
