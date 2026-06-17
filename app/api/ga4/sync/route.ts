import { NextResponse } from "next/server";
import { syncClientGa4 } from "@/lib/ga4/sync-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SyncRequestBody = { clientId?: number };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
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
    .select("id,ga4_property_id,ga4_id")
    .eq("id", clientId)
    .single<{ id: number; ga4_property_id: string | null; ga4_id: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json({ error: clientError?.message ?? "Client not found" }, { status: 404 });
  }

  const propertyId = (clientRow.ga4_property_id ?? clientRow.ga4_id ?? "").trim();
  if (!propertyId) {
    return NextResponse.json({ error: "Client has no GA4 property ID configured." }, { status: 400 });
  }

  try {
    const result = await syncClientGa4(admin, clientId, propertyId);
    return NextResponse.json({ ok: true, snapshot: result.snapshot, signals: result.signals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GA4 sync failed" },
      { status: 500 },
    );
  }
}
