import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SitemapsManager from "@/components/sitemaps/sitemaps-manager";
import type { SitemapSnapshot } from "@/lib/types/client";

type ClientRow = {
  id: number;
  account_name: string;
  website: string | null;
  marketing_strategist: string | null;
};

type GscSitemapRow = {
  client_id: number;
  sitemap_url: string;
  last_submitted: string | null;
  last_downloaded: string | null;
  urls_submitted: number;
  urls_indexed: number;
  errors: number;
  snapshot_id: number;
};

export type SitemapRow = {
  client: ClientRow;
  snapshot: SitemapSnapshot | null;
  gsc: GscSitemapRow | null;
};

export default async function SitemapsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [clientsResult, snapshotsResult, gscResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, account_name, website, marketing_strategist")
      .not("website", "is", null)
      .neq("website", "")
      .order("account_name", { ascending: true })
      .returns<ClientRow[]>(),

    supabase
      .from("client_sitemap_snapshots")
      .select(
        "id, client_id, sitemap_url, run_status, error_message, url_count, with_lastmod_count, latest_lastmod, stale_90_count, fetched_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<SitemapSnapshot[]>(),

    supabase
      .from("client_gsc_sitemaps")
      .select(
        "client_id, sitemap_url, last_submitted, last_downloaded, urls_submitted, urls_indexed, errors, snapshot_id",
      )
      .order("snapshot_id", { ascending: false })
      .limit(1000)
      .returns<GscSitemapRow[]>(),
  ]);

  const clients = clientsResult.data ?? [];

  // Latest snapshot per client
  const snapshotByClient = new Map<number, SitemapSnapshot>();
  for (const row of snapshotsResult.data ?? []) {
    if (!snapshotByClient.has(row.client_id)) {
      snapshotByClient.set(row.client_id, row);
    }
  }

  // Latest GSC sitemap per client (highest snapshot_id wins)
  const gscByClient = new Map<number, GscSitemapRow>();
  for (const row of gscResult.data ?? []) {
    const existing = gscByClient.get(row.client_id);
    if (!existing || row.snapshot_id > existing.snapshot_id) {
      gscByClient.set(row.client_id, row);
    }
  }

  const rows: SitemapRow[] = clients.map((client) => ({
    client,
    snapshot: snapshotByClient.get(client.id) ?? null,
    gsc: gscByClient.get(client.id) ?? null,
  }));

  return <SitemapsManager rows={rows} />;
}
