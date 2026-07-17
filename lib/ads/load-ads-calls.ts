import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { fetchLatestSnapshotsByClient } from "@/lib/dashboard/snapshot-queries";
import type { AdsCallRow, ClientRow } from "@/lib/types/client";

export type FlatCall = {
  clientId: number;
  accountName: string;
  campaignName: string;
  startTime: string | null;
  durationSeconds: number;
  status: string;
  callType: string;
  callerAreaCode: string | null;
  displayLocation: string;
  snapshotAt: string | null;
};

export type AdsCallsData = {
  calls: FlatCall[];
  summary: { total: number; received: number; missed: number; avgDurationSeconds: number; clientsWithCalls: number };
  lastSyncAt: string | null;
  loadError: string | null;
};

type CallsSnapshotRow = {
  client_id: number;
  created_at?: string;
  updated_at?: string | null;
  calls?: AdsCallRow[] | null;
};

function isReceived(status: string): boolean {
  return status.toUpperCase().includes("RECEIVED") || status.toUpperCase() === "CONNECTED";
}
function isMissed(status: string): boolean {
  return status.toUpperCase().includes("MISSED");
}

export async function loadAdsCalls(supabase: SupabaseClient): Promise<AdsCallsData> {
  const empty: AdsCallsData = {
    calls: [],
    summary: { total: 0, received: 0, missed: 0, avgDurationSeconds: 0, clientsWithCalls: 0 },
    lastSyncAt: null,
    loadError: null,
  };

  const { data: clientsRaw, error: clientsError } = await supabase
    .from("clients")
    .select("id, account_name, ads_customer_id");
  if (clientsError) return { ...empty, loadError: clientsError.message };

  const clients = (clientsRaw ?? []) as Pick<ClientRow, "id" | "account_name" | "ads_customer_id">[];
  const nameById = new Map<number, string>();
  const adsClientIds = new Set<number>();
  for (const c of clients) {
    nameById.set(c.id, c.account_name ?? "Unnamed client");
    if (isSyncableAdsCustomerId(c.ads_customer_id)) adsClientIds.add(c.id);
  }

  const snapshots = await fetchLatestSnapshotsByClient<CallsSnapshotRow>(
    supabase,
    "client_ads_snapshots",
    "client_id, created_at, updated_at, calls",
  );

  const flat: FlatCall[] = [];
  let lastSyncAt: string | null = null;
  const clientsWithCalls = new Set<number>();
  for (const snap of snapshots) {
    if (!adsClientIds.has(snap.client_id)) continue;
    const at = snap.updated_at ?? snap.created_at ?? null;
    if (at && (!lastSyncAt || at > lastSyncAt)) lastSyncAt = at;
    for (const call of snap.calls ?? []) {
      clientsWithCalls.add(snap.client_id);
      flat.push({
        clientId: snap.client_id,
        accountName: nameById.get(snap.client_id) ?? "Unnamed client",
        campaignName: call.campaign_name,
        startTime: call.start_time,
        durationSeconds: call.duration_seconds,
        status: call.status,
        callType: call.call_type,
        callerAreaCode: call.caller_area_code,
        displayLocation: call.display_location,
        snapshotAt: at,
      });
    }
  }

  flat.sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));

  const received = flat.filter((c) => isReceived(c.status)).length;
  const missed = flat.filter((c) => isMissed(c.status)).length;
  const totalDuration = flat.reduce((s, c) => s + c.durationSeconds, 0);

  return {
    calls: flat,
    summary: {
      total: flat.length,
      received,
      missed,
      avgDurationSeconds: flat.length ? Math.round(totalDuration / flat.length) : 0,
      clientsWithCalls: clientsWithCalls.size,
    },
    lastSyncAt,
    loadError: null,
  };
}
