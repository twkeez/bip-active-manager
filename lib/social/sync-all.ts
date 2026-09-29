import type { SupabaseClient } from "@supabase/supabase-js";
import { createSocialRunContext, syncClientSocial } from "@/lib/social/sync-client";
import { runInBatches } from "@/lib/sync/run-in-batches";
import { loadStaleness, stalestFirst } from "@/lib/sync/staleness";

/** Leaves room inside the 800s request limit (Vercel Pro) to report what happened. */
export const SOCIAL_DEADLINE_MS = 660_000;

/**
 * Every connected client's social data in one pass.
 *
 * Only clients that already have a Facebook connection are touched: page
 * matching is a guess that a person should confirm once, and a nightly job is
 * the wrong place to be guessing. Clients nobody has connected are skipped,
 * not failed.
 */

/**
 * Clients at a time. 6 fits Meta's page-level limits comfortably (about 1,400
 * calls a night across 60 pages) and ran all 106 clients in 136s on
 * 2026-09-29; 3 left the job over its time budget.
 */
export const SOCIAL_BATCH_SIZE = 6;

export type SocialSyncAllResult = {
  clientId: number;
  accountName: string;
  status: "ok" | "failed";
  warnings?: string[];
  error?: string;
};

export type SocialSyncAllSummary = {
  synced: number;
  failed: number;
  skipped: number;
  warned: number;
  /** Clients the time budget did not reach; they go first next night. */
  deferred: number;
  deferredNames: string[];
  results: SocialSyncAllResult[];
};

export async function runSocialSyncAll(
  admin: SupabaseClient,
  startedAt: number = Date.now(),
): Promise<SocialSyncAllSummary> {
  const { data: connections, error } = await admin
    .from("client_social_connections")
    .select("client_id")
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const connectedIds = [...new Set((connections ?? []).map((row) => row.client_id as number))];

  const { data: clientsRaw, error: clientsError } = await admin
    .from("clients")
    .select("id, account_name")
    .order("account_name", { ascending: true });
  if (clientsError) throw new Error(clientsError.message);

  const clients = (clientsRaw ?? []).filter((client) =>
    connectedIds.includes(client.id as number),
  );

  // Stalest first, inside a time budget: it used to go alphabetically until
  // the platform killed it at 300s, three nights running, so clients late in
  // the alphabet were never refreshed (found 2026-09-29). Whatever the budget
  // does not reach leads the next run and is reported, not dropped.
  const staleness = await loadStaleness(admin, "client_social_daily_snapshots");
  const ordered = stalestFirst(
    clients.map((client) => ({ id: client.id as number, account_name: client.account_name as string })),
    staleness,
  );
  const context = await createSocialRunContext(admin);

  const { results, deferred } = await runInBatches(
    ordered,
    SOCIAL_BATCH_SIZE,
    async (client): Promise<SocialSyncAllResult> => {
      const clientId = client.id;
      const accountName = client.account_name;
      try {
        const result = await syncClientSocial(admin, clientId, context);
        return {
          clientId,
          accountName,
          status: "ok",
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
        };
      } catch (syncError) {
        // One page losing access must not cost the other hundred.
        return {
          clientId,
          accountName,
          status: "failed",
          error: syncError instanceof Error ? syncError.message : "Social sync failed",
        };
      }
    },
    { deadline: startedAt + SOCIAL_DEADLINE_MS },
  );

  return {
    synced: results.filter((result) => result.status === "ok").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: (clientsRaw ?? []).length - clients.length,
    warned: results.filter((result) => result.warnings?.length).length,
    deferred: deferred.length,
    deferredNames: deferred.map((client) => client.account_name),
    results,
  };
}
