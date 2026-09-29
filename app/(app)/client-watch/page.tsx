import PoobahListView from "@/components/poobah/poobah-list-view";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { requirePoobahAdmin } from "@/lib/poobah/page-auth";
import { listWatches } from "@/lib/poobah/store";
import type { PoobahSummary } from "@/lib/poobah/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ClientOption = { id: number; name: string };

export default async function PoobahClientWatchPage() {
  await requirePoobahAdmin();
  const admin = createAdminClient();
  let watches: PoobahSummary[] = [];
  let clients: ClientOption[] = [];
  let loadError: string | null = null;
  try {
    const [list, rows] = await Promise.all([
      listWatches(admin),
      fetchAllRows<{ id: number; account_name: string | null; public_name: string | null }>(
        (from, to) => admin.from("clients").select("id,account_name,public_name").order("id").range(from, to),
        "clients",
      ),
    ]);
    watches = list;
    clients = rows
      .map((row) => ({ id: row.id, name: row.public_name?.trim() || row.account_name?.trim() || `Client ${row.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load Poobah Client Watch.";
  }
  return <PoobahListView watches={watches} clients={clients} loadError={loadError} />;
}
