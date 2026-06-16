import { NextResponse } from "next/server";
import { syncClientAds } from "@/lib/ads/sync-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SyncRequestBody = {
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
    .select("id,ads_customer_id")
    .eq("id", clientId)
    .single<{ id: number; ads_customer_id: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }
  if (!clientRow.ads_customer_id?.trim()) {
    return NextResponse.json(
      { error: "Client is missing ads_customer_id." },
      { status: 400 },
    );
  }

  try {
    const result = await syncClientAds(admin, clientId, clientRow.ads_customer_id);
    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      signals: result.signals,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ads sync failed",
      },
      { status: 500 },
    );
  }
}
