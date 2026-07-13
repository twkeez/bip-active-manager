import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { IlluminareClientRow } from "@/lib/illuminare/types";
import type { IlluminareDeliverableRow } from "@/lib/illuminare/deliverables";
import { computeClientHealth, type ClientHealth } from "@/lib/illuminare/health";
import IlluminareClientList from "@/components/illuminare/illuminare-client-list";

export default async function IlluminarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [clientsResult, deliverablesResult] = await Promise.all([
    supabase
      .from("illuminare_clients")
      .select(
        "id, account_name, account_lead, status, website, basecamp_project_id, notes, created_at, updated_at",
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
    );
  }

  return (
    <IlluminareClientList
      clients={clients}
      healthByClient={healthByClient}
      loadError={clientsResult.error?.message ?? null}
    />
  );
}
