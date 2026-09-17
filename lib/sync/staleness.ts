import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which clients have gone longest without a refresh.
 *
 * A nightly job that always starts at the top of the alphabet refreshes the
 * same clients every night and never reaches the tail when it runs out of
 * time. Ordering by the age of each client's newest snapshot means a run that
 * only gets halfway still leaves the whole roster evenly fresh, and a client
 * that has never synced goes first.
 */

export type StalenessOrder = {
  /** Newest snapshot per client, ISO. Missing means never synced. */
  newestByClient: Map<number, string>;
  /** Oldest first, never-synced before that. */
  order: (clientId: number) => number;
};

/** One row per client is all this needs, but the tables store one per run. */
const SCAN_LIMIT = 20_000;

export async function loadStaleness(
  admin: SupabaseClient,
  table: string,
  { column = "created_at" }: { column?: string } = {},
): Promise<StalenessOrder> {
  const newestByClient = new Map<number, string>();
  const { data, error } = await admin
    .from(table)
    .select(`client_id, ${column}`)
    .order(column, { ascending: false })
    .limit(SCAN_LIMIT);
  // A table that cannot be read just means nothing is known to be fresh, which
  // orders every client equally rather than failing the run.
  if (!error) {
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      const clientId = Number(row.client_id);
      const at = row[column];
      if (!Number.isFinite(clientId) || typeof at !== "string") continue;
      if (!newestByClient.has(clientId)) newestByClient.set(clientId, at);
    }
  }

  return {
    newestByClient,
    order: (clientId: number) => {
      const at = newestByClient.get(clientId);
      return at ? new Date(at).getTime() : 0;
    },
  };
}

export function stalestFirst<T extends { id: number }>(clients: T[], staleness: StalenessOrder): T[] {
  return [...clients].sort((a, b) => staleness.order(a.id) - staleness.order(b.id));
}
