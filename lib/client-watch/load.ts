import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { CLIENT_WATCH_MIGRATION, WATCH_READ_COLUMNS, isMissingTableError, type WatchRead } from "./shape";

/**
 * Client Watch reads as Home shows them, read with the signed-in person's own
 * session, so only admins see them (the table's access rule). The Basecamp
 * side comes from the Response Report, which Home already loads.
 */

export type WatchReads = {
  /** The newest good read per client. */
  latest: Map<number, WatchRead>;
  /** The newest read of any kind per client, so a failure after a good read shows. */
  attempts: Map<number, WatchRead>;
  /** When the newest read of any client was made. */
  lastReadAt: string | null;
  /** Set when the table hasn't been created yet: what to run. */
  setupError: string | null;
  /** Set when the reads couldn't be loaded for any other reason. */
  loadError: string | null;
};

async function loadView(supabase: SupabaseClient, view: "client_watch_latest" | "client_watch_last_attempt"): Promise<WatchRead[]> {
  return fetchAllRows<WatchRead>(
    (from, to) => supabase.from(view).select(WATCH_READ_COLUMNS).order("client_id").order("id").range(from, to),
    "Client Watch reads",
  );
}

export async function loadWatchReads(supabase: SupabaseClient): Promise<WatchReads> {
  const empty = { latest: new Map(), attempts: new Map(), lastReadAt: null };
  try {
    const [latest, attempts] = await Promise.all([loadView(supabase, "client_watch_latest"), loadView(supabase, "client_watch_last_attempt")]);
    return {
      latest: new Map(latest.map((r) => [r.client_id, r])),
      attempts: new Map(attempts.map((r) => [r.client_id, r])),
      lastReadAt: attempts.map((a) => a.read_at).sort().pop() ?? null,
      setupError: null,
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingTableError(message)) {
      return { ...empty, setupError: `Client Watch isn't set up yet: ${CLIENT_WATCH_MIGRATION} needs to be run in Supabase.`, loadError: null };
    }
    return { ...empty, setupError: null, loadError: `Client Watch reads couldn't be loaded: ${message}` };
  }
}
