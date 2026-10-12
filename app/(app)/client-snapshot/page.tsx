import { redirect } from "next/navigation";
import SnapshotIndex, { type SnapshotRow } from "@/components/client-snapshot/snapshot-index";
import { getProfile } from "@/lib/auth/profile";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Client Snapshot home: the clients already in the pilot (published, linked
 * or with recipients) and their status, and a way to open any client's
 * snapshot. Admins only, like the preview pages it leads to.
 */
export default async function ClientSnapshotIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const page = <T,>(table: string, select: string) =>
    fetchAllRows<T>((from, to) => admin.from(table).select(select).order("id").range(from, to), table);
  const [clients, publications, links, recipients, sends] = await Promise.all([
    page<{ id: number; account_name: string; public_name: string | null }>("clients", "id,account_name,public_name"),
    page<{ id: number; client_id: number; published_at: string }>("client_snapshot_publications", "id,client_id,published_at"),
    page<{ id: number; client_id: number; revoked_at: string | null; view_count: number; last_viewed_at: string | null }>(
      "client_snapshot_links",
      "id,client_id,revoked_at,view_count,last_viewed_at",
    ),
    fetchAllRows<{ client_id: number; emails: string[] }>(
      (from, to) => admin.from("client_snapshot_recipients").select("client_id,emails").order("client_id").range(from, to),
      "recipients",
    ),
    page<{ id: number; client_id: number; sent_at: string; status: string; recipients: string[] }>(
      "client_snapshot_sends",
      "id,client_id,sent_at,status,recipients",
    ),
  ]);

  const latest = <T extends { client_id: number }>(rows: T[], at: (row: T) => string) => {
    const map = new Map<number, T>();
    for (const row of rows) {
      const current = map.get(row.client_id);
      if (!current || at(row) > at(current)) map.set(row.client_id, row);
    }
    return map;
  };
  const lastPublication = latest(publications, (row) => row.published_at);
  const lastSend = latest(sends, (row) => row.sent_at);
  const pilotIds = new Set([...publications, ...links, ...sends].map((row) => row.client_id));
  for (const row of recipients) if (row.emails?.length) pilotIds.add(row.client_id);

  const nameOf = (client: { account_name: string; public_name: string | null }) => client.public_name?.trim() || client.account_name;
  const rows: SnapshotRow[] = clients
    .filter((client) => pilotIds.has(client.id))
    .map((client) => {
      const active = links.filter((link) => link.client_id === client.id && !link.revoked_at);
      const send = lastSend.get(client.id);
      return {
        id: client.id,
        name: nameOf(client),
        publishedAt: lastPublication.get(client.id)?.published_at ?? null,
        activeLinks: active.length,
        views: active.reduce((sum, link) => sum + (link.view_count ?? 0), 0),
        recipients: recipients.find((row) => row.client_id === client.id)?.emails ?? [],
        lastSend: send ? { at: send.sent_at, status: send.status, to: send.recipients } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SnapshotIndex
      rows={rows}
      clients={clients.map((client) => ({ id: client.id, name: nameOf(client) })).sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
