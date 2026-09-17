import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClientSearchConsole } from "@/lib/seo/sync-client";
import { getGoogleAccessTokenForUser } from "@/lib/google/token-manager";
import type { GscPageMetric, GscQueryMetric, GscSignal } from "@/lib/types/client";

/**
 * The "sync" button for one client's Search Console data.
 *
 * The work lives in lib/seo/sync-client so the nightly job runs exactly this.
 * What stays here is the session check, the signed-in person's own Google token
 * (which reaches properties the service account may not), and the rows the
 * screen reads back.
 */

type SearchConsoleRequestBody = {
  clientId?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SearchConsoleRequestBody;
  try {
    body = (await request.json()) as SearchConsoleRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id,website,sc_url")
    .eq("id", clientId)
    .single<{ id: number; website: string | null; sc_url: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  try {
    // The signed-in person's own Google token first: some properties are shared
    // with a person rather than the service account, and the button is where
    // that matters. The nightly job has no user and falls back to the service
    // credentials, exactly as before.
    const userToken = await getGoogleAccessTokenForUser(admin, user.id).catch(() => null);
    const result = await syncClientSearchConsole(
      admin,
      clientId,
      clientRow,
      userToken ?? undefined,
    );

    const { data: pageRows } = await admin
      .from("client_gsc_page_metrics")
      .select("*")
      .eq("snapshot_id", result.snapshot.id)
      .order("impressions", { ascending: false })
      .limit(10)
      .returns<GscPageMetric[]>();
    const { data: queryRows } = await admin
      .from("client_gsc_query_metrics")
      .select("*")
      .eq("snapshot_id", result.snapshot.id)
      .order("impressions", { ascending: false })
      .limit(10)
      .returns<GscQueryMetric[]>();
    const { data: signalRows } = await admin
      .from("client_gsc_signals")
      .select("*")
      .eq("snapshot_id", result.snapshot.id)
      .order("created_at", { ascending: false })
      .returns<GscSignal[]>();

    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      pageMetrics: pageRows ?? [],
      queryMetrics: queryRows ?? [],
      signals: signalRows ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search Console sync failed" },
      { status: 500 },
    );
  }
}
