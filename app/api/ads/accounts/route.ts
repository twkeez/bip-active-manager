import { NextResponse } from "next/server";
import { listAdsAccounts, suggestAccounts } from "@/lib/ads/list-accounts";
import { isPlaceholderKey } from "@/lib/coal-mines/service-coverage";
import { getClientActiveServices } from "@/lib/clients/service-active";
import { normalizeCustomerId, isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import type { ClientRow } from "@/lib/types/client";

/**
 * The ads accounts under our manager, and which clients are missing one.
 *
 * GET lists both and pairs them up; PUT attaches one account to one client.
 * Attaching stays an explicit act rather than something the matcher does on
 * its own: the wrong account would show a practice another practice's spend.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAdmin(supabase))) return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { email: user.email ?? null };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();
  const { data: clientRows, error } = await admin.from("clients").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let accounts;
  try {
    accounts = await listAdsAccounts();
  } catch (listError) {
    return NextResponse.json(
      { error: listError instanceof Error ? listError.message : "Could not list ads accounts" },
      { status: 502 },
    );
  }

  const attached = new Set(
    ((clientRows ?? []) as ClientRow[])
      .map((client) => normalizeCustomerId(client.ads_customer_id ?? ""))
      .filter(Boolean),
  );

  // Clients buying ads with no usable ID: the field is empty, or holds a note.
  const needing = ((clientRows ?? []) as ClientRow[])
    .filter((client) => getClientActiveServices(client).ppc)
    .filter((client) => !isSyncableAdsCustomerId(client.ads_customer_id))
    .map((client) => ({
      clientId: client.id,
      accountName: client.account_name,
      stored: client.ads_customer_id ?? null,
      storedIsNote: isPlaceholderKey(client.ads_customer_id),
      suggestions: suggestAccounts(client.account_name, accounts),
    }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName));

  return NextResponse.json({
    accounts,
    needing,
    /** Accounts nobody is reporting on — often the other half of the same gap. */
    unattached: accounts.filter((account) => !attached.has(normalizeCustomerId(account.customerId))),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const payload = (await request.json().catch(() => null)) as
    | { clientId?: unknown; customerId?: unknown }
    | null;
  const clientId = Number(payload?.clientId);
  const customerId = normalizeCustomerId(String(payload?.customerId ?? ""));
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  if (!isSyncableAdsCustomerId(customerId)) {
    return NextResponse.json({ error: "That is not a Google Ads customer ID." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Two clients on one account would double-count spend, and usually means the
  // wrong one was picked from a group that shares a name.
  const { data: clash } = await admin
    .from("clients")
    .select("id, account_name")
    .eq("ads_customer_id", customerId)
    .neq("id", clientId)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: `That account is already attached to ${(clash as { account_name: string }).account_name}.` },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("clients")
    .update({ ads_customer_id: customerId })
    .eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customerId });
}
