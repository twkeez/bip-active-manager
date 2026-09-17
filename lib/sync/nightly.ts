import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClientSearchConsole } from "@/lib/seo/sync-client";
import { syncClientGa4 } from "@/lib/ga4/sync-client";
import { syncClientGbp } from "@/lib/gbp/sync-client";
import {
  runInBatches,
  summarise,
  type ClientSyncResult,
  type ClientSyncSummary,
} from "@/lib/sync/run-in-batches";
import { loadStaleness, stalestFirst } from "@/lib/sync/staleness";

/**
 * The nightly refresh for the data that only ever refreshed by hand.
 *
 * Ads and social have run nightly since the ads outage; Search Console, GA4 and
 * Business Profile did not, so their numbers were as old as the last person who
 * remembered to press a button — Search Console two weeks, GA4 and reviews
 * nearly two months, while every screen presented them as current. Same shape
 * as the ads job on purpose: eligible clients only, stalest first, per-client
 * failures reported without failing the run.
 *
 * Each source is its own job so a broken Places key cannot stop Search Console,
 * and so the freshness canary can name which one stopped.
 */

/** Leaves room inside the 300s request limit to report what happened. */
export const DEADLINE_MS = 240_000;

type ClientRow = {
  id: number;
  account_name: string;
  sc_url?: string | null;
  website?: string | null;
  ga4_property_id?: string | null;
  ga4_id?: string | null;
  google_place_id?: string | null;
};

const present = (value: string | null | undefined) => Boolean((value ?? "").trim());

/**
 * GA4 reports need the numeric property ID. Most clients have the measurement
 * ID ("G-1TVHPD8VRN") stored instead, which the API rejects outright — so it is
 * recognised here and reported as something to fix rather than retried nightly.
 */
const numericGa4Property = (client: ClientRow) => {
  const value = ((client.ga4_property_id ?? client.ga4_id) ?? "").trim();
  return /^\d+$/.test(value) ? value : null;
};

/**
 * Errors that mean "this account is not ours to read", not "the sync broke".
 * Search Console answers 403 for a property our credentials are not verified
 * on, which is the state most of the roster is in.
 */
function isBlocked(message: string): boolean {
  return (
    /\b403\b/.test(message) ||
    /sufficient permission|permission_denied|forbidden|unauthorized|not have access/i.test(message) ||
    /Invalid property ID|numeric Property ID/i.test(message)
  );
}

async function runSyncAll({
  admin,
  columns,
  snapshotTable,
  eligible,
  batchSize,
  sync,
  startedAt,
}: {
  admin: SupabaseClient;
  columns: string;
  snapshotTable: string;
  eligible: (client: ClientRow) => boolean;
  batchSize: number;
  sync: (client: ClientRow) => Promise<unknown>;
  startedAt: number;
}): Promise<ClientSyncSummary> {
  const { data, error } = await admin.from("clients").select(columns);
  if (error) throw new Error(error.message);

  const clients = (data ?? []) as unknown as ClientRow[];
  const runnable = clients.filter(eligible);
  const staleness = await loadStaleness(admin, snapshotTable);
  const ordered = stalestFirst(runnable, staleness);

  const { results, deferred } = await runInBatches(
    ordered,
    batchSize,
    async (client): Promise<ClientSyncResult> => {
      try {
        await sync(client);
        return { clientId: client.id, accountName: client.account_name, status: "ok" };
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "Sync failed";
        return {
          clientId: client.id,
          accountName: client.account_name,
          status: isBlocked(message) ? "blocked" : "failed",
          // One line is enough in a nightly log; the snapshot row keeps the rest.
          error: message.replace(/\s+/g, " ").slice(0, 200),
        };
      }
    },
    { deadline: startedAt + DEADLINE_MS },
  );

  return summarise(results, {
    skipped: clients.length - runnable.length,
    deferred: deferred.length,
  });
}

/** Four at a time: Search Console allows a modest QPS per property. */
export function runSearchConsoleSyncAll(admin: SupabaseClient, startedAt = Date.now()) {
  return runSyncAll({
    admin,
    columns: "id, account_name, sc_url, website",
    snapshotTable: "client_gsc_snapshots",
    eligible: (client) => present(client.sc_url) || present(client.website),
    batchSize: 4,
    sync: (client) => syncClientSearchConsole(admin, client.id, client),
    startedAt,
  });
}

/** GA4 runs seven reports per client, so it gets more concurrency, not less. */
export function runGa4SyncAll(admin: SupabaseClient, startedAt = Date.now()) {
  return runSyncAll({
    admin,
    columns: "id, account_name, ga4_property_id, ga4_id",
    snapshotTable: "client_ga4_snapshots",
    eligible: (client) => numericGa4Property(client) !== null,
    batchSize: 6,
    sync: (client) => syncClientGa4(admin, client.id, numericGa4Property(client) ?? ""),
    startedAt,
  });
}

/** One Places call each, so the only limit worth respecting is the API quota. */
export function runGbpSyncAll(admin: SupabaseClient, startedAt = Date.now()) {
  return runSyncAll({
    admin,
    columns: "id, account_name, google_place_id",
    snapshotTable: "client_gbp_snapshots",
    eligible: (client) => present(client.google_place_id),
    batchSize: 6,
    sync: (client) => syncClientGbp(admin, client.id, (client.google_place_id ?? "").trim()),
    startedAt,
  });
}
