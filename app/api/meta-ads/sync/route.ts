import { NextResponse } from "next/server";
import { syncClientMetaAds } from "@/lib/ads/sync-meta-ads";
import { fetchMetaAdAccountForClient, listMetaAdAccounts } from "@/lib/social/meta";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";
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
    .select("id,account_name,meta_ad_account_id")
    .eq("id", clientId)
    .single<{ id: number; account_name: string; meta_ad_account_id: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  try {
    const tokenState = await getMetaAccessTokenForSync(admin);
    const account = await fetchMetaAdAccountForClient(
      clientRow.account_name,
      clientRow.meta_ad_account_id,
      tokenState.accessToken,
    );
    if (!account) {
      const candidates = await listMetaAdAccounts(tokenState.accessToken);
      const noAccess = candidates.length === 0;
      return NextResponse.json(
        {
          error: noAccess
            ? "No Meta ad accounts are accessible with the current token. Confirm META_GRAPH_ACCESS_TOKEN is a System User / long-lived token that includes the ads_read permission."
            : "No matching Meta ad account found for this client by name. Paste the numeric ad-account ID into the Meta Ad Account field to map it manually.",
          candidateAdAccounts: candidates.slice(0, 15),
        },
        { status: 404 },
      );
    }

    // Persist the resolved account id (digits only) so future syncs are
    // deterministic and the settings field reflects what's connected.
    const digits = account.id.replace(/[^0-9]/g, "");
    const storedDigits = (clientRow.meta_ad_account_id ?? "").replace(/[^0-9]/g, "");
    if (digits && digits !== storedDigits) {
      await admin.from("clients").update({ meta_ad_account_id: digits }).eq("id", clientId);
    }

    const snapshot = await syncClientMetaAds(
      admin,
      clientId,
      account.id,
      account.name,
      tokenState.accessToken,
    );
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta ads sync failed" },
      { status: 500 },
    );
  }
}
