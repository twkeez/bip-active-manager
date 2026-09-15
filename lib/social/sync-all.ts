import type { SupabaseClient } from "@supabase/supabase-js";
import { syncClientSocial } from "@/lib/social/sync-client";

/**
 * Every connected client's social data in one pass.
 *
 * Only clients that already have a Facebook connection are touched: page
 * matching is a guess that a person should confirm once, and a nightly job is
 * the wrong place to be guessing. Clients nobody has connected are skipped,
 * not failed.
 */

/** Meta rate-limits per app, so this stays deliberately modest. */
export const SOCIAL_BATCH_SIZE = 3;

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
  results: SocialSyncAllResult[];
};

export async function runSocialSyncAll(
  admin: SupabaseClient,
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

  const results: SocialSyncAllResult[] = [];
  for (let index = 0; index < clients.length; index += SOCIAL_BATCH_SIZE) {
    const batch = clients.slice(index, index + SOCIAL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (client): Promise<SocialSyncAllResult> => {
        const clientId = client.id as number;
        const accountName = client.account_name as string;
        try {
          const result = await syncClientSocial(admin, clientId);
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
      }),
    );
    results.push(...batchResults);
  }

  return {
    synced: results.filter((result) => result.status === "ok").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: (clientsRaw ?? []).length - clients.length,
    warned: results.filter((result) => result.warnings?.length).length,
    results,
  };
}
