import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDaysAgo } from "@/lib/time";
import type { BasecampSyncState, ClientRow } from "@/lib/types/client";
import type { ClientFreshness, LightweightThreadPreview, SignalSummary } from "@/lib/dashboard/snapshot-queries";
import {
  computeDuplicateBasecampProjectCounts,
  fetchAdsSignalSummariesByClient,
  fetchBasecampSyncState,
  fetchGscSignalSummariesByClient,
  fetchHasAdsSnapshotByClient,
  fetchLightweightThreadPreviews,
  fetchSnapshotFreshnessByClient,
} from "@/lib/dashboard/snapshot-queries";

export type ClientListInitialData = {
  clients: ClientRow[];
  syncState: BasecampSyncState | null;
  duplicateProjectIdCounts: Record<string, number>;
  gscSignalSummariesByClient: Record<number, SignalSummary>;
  adsSignalSummariesByClient: Record<number, SignalSummary>;
  freshnessByClient: Record<number, ClientFreshness>;
  hasAdsSnapshotByClient: Record<number, boolean>;
  threadPreviews: LightweightThreadPreview[];
  loadError: string | null;
};

export async function loadClientListData(
  supabase: SupabaseClient,
): Promise<ClientListInitialData> {
  const empty: ClientListInitialData = {
    clients: [],
    syncState: null,
    duplicateProjectIdCounts: {},
    gscSignalSummariesByClient: {},
    adsSignalSummariesByClient: {},
    freshnessByClient: {},
    hasAdsSnapshotByClient: {},
    threadPreviews: [],
    loadError: null,
  };

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });

  if (error) {
    return { ...empty, loadError: error.message };
  }

  const clients = (data ?? []) as ClientRow[];
  const threadsCutoffIso = isoDaysAgo(30);

  const [
    syncStateRaw,
    gscSignalSummariesByClient,
    adsSignalSummariesByClient,
    freshnessByClient,
    hasAdsSnapshotByClient,
    threadPreviews,
  ] = await Promise.all([
    fetchBasecampSyncState(supabase),
    fetchGscSignalSummariesByClient(supabase),
    fetchAdsSignalSummariesByClient(supabase),
    fetchSnapshotFreshnessByClient(supabase),
    fetchHasAdsSnapshotByClient(supabase),
    fetchLightweightThreadPreviews(supabase, threadsCutoffIso),
  ]);

  return {
    clients,
    syncState: (syncStateRaw as BasecampSyncState | null) ?? null,
    duplicateProjectIdCounts: computeDuplicateBasecampProjectCounts(clients),
    gscSignalSummariesByClient,
    adsSignalSummariesByClient,
    freshnessByClient,
    hasAdsSnapshotByClient,
    threadPreviews,
    loadError: null,
  };
}
