import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IlluminareClientRow } from "@/lib/illuminare/types";
import type { IlluminareDeliverableRow } from "@/lib/illuminare/deliverables";
import { computeClientHealth, type ClientHealth } from "@/lib/illuminare/health";
import IlluminareClientList from "@/components/illuminare/illuminare-client-list";

async function loadBasecampConnection() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("illuminare_basecamp_oauth_tokens")
      .select("account_id, updated_at")
      .eq("id", 1)
      .maybeSingle<{ account_id: string; updated_at: string }>();
    return data
      ? { connected: true, accountId: data.account_id, updatedAt: data.updated_at }
      : { connected: false, accountId: null, updatedAt: null };
  } catch {
    // Missing table (migration not run yet) or admin misconfig — treat as unconnected.
    return { connected: false, accountId: null, updatedAt: null };
  }
}

export default async function IlluminarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const basecampResult =
    typeof params.basecamp === "string" ? params.basecamp : null;
  const basecampProjects =
    typeof params.projects === "string" ? params.projects : null;
  const basecampConnection = await loadBasecampConnection();

  const [clientsResult, deliverablesResult] = await Promise.all([
    supabase
      .from("illuminare_clients")
      .select(
        "id, account_name, account_lead, status, website, basecamp_project_id, notes, last_communication_at, last_comm_is_internal, needs_reply, days_stale, comms_synced_at, created_at, updated_at",
      )
      .order("account_name", { ascending: true }),
    supabase
      .from("illuminare_deliverables")
      .select(
        "id, client_id, title, detail, kind, cadence, status, start_date, due_date, completed_at, follow_up_interval_days, follow_up_at, last_followed_up_at, notes, created_at, updated_at",
      ),
  ]);

  const clients = (clientsResult.data ?? []) as IlluminareClientRow[];
  const deliverables = (deliverablesResult.data ?? []) as IlluminareDeliverableRow[];

  const deliverablesByClient = new Map<number, IlluminareDeliverableRow[]>();
  for (const deliverable of deliverables) {
    const list = deliverablesByClient.get(deliverable.client_id) ?? [];
    list.push(deliverable);
    deliverablesByClient.set(deliverable.client_id, list);
  }

  const healthByClient: Record<number, ClientHealth> = {};
  for (const client of clients) {
    healthByClient[client.id] = computeClientHealth(
      client,
      deliverablesByClient.get(client.id) ?? [],
      undefined,
      { needsReply: client.needs_reply === true, daysStale: client.days_stale ?? null },
    );
  }

  return (
    <IlluminareClientList
      clients={clients}
      healthByClient={healthByClient}
      loadError={clientsResult.error?.message ?? null}
      basecamp={{
        connected: basecampConnection.connected,
        accountId: basecampConnection.accountId,
        result: basecampResult,
        projects: basecampProjects,
      }}
    />
  );
}
