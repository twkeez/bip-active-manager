import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncOnboardingItemsToServices } from "@/lib/clients/onboarding";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = Number(params.id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const { data: clientRow, error: fetchError } = await supabase
    .from("clients")
    .select("id,account_name")
    .eq("id", clientId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!clientRow) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("clients").delete().eq("id", clientId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: clientId,
    accountName: clientRow.account_name,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = Number(params.id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  let body: Record<string, string | number | boolean | null>;
  try {
    body = (await request.json()) as Record<string, string | number | boolean | null>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed = [
    "ads_customer_id",
    "meta_ad_account_id",
    "sc_url",
    "ga4_property_id",
    "ga4_id",
    "gtm_container_id",
    "google_place_id",
    "basecamp_project_id",
    "harvest_project_id",
    "harvest_client_id",
    "website",
    "public_name",
    "contact_name",
    "contact_email",
    "shared_drive_url",
    "city",
    "marketing_strategist",
    "tier",
    "seo",
    "ppc",
    "smm",
    "blog",
    "orm",
  ] as const;
  const numericAllowed = ["total_package_hours", "hours_for_strategist"] as const;
  const booleanAllowed = ["awaiting_website_launch"] as const;

  const patch: Record<string, string | number | boolean | null> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key];
      patch[key] = typeof value === "string" ? value.trim() || null : null;
    }
  }
  for (const key of numericAllowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = body[key];
      if (value == null || (typeof value === "string" && value.trim() === "")) {
        patch[key] = null;
      } else {
        const n = Number(value);
        patch[key] = Number.isFinite(n) ? n : null;
      }
    }
  }

  for (const key of booleanAllowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      // Accept a real boolean, or the strings a form might send.
      const value = body[key] as unknown;
      patch[key] = value === true || value === "true";
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If services changed, reconcile the onboarding steps to match immediately.
  if (["seo", "ppc", "smm", "blog", "orm"].some((k) => k in patch)) {
    try {
      await syncOnboardingItemsToServices(supabase, clientId);
    } catch {
      // best-effort — the client update already succeeded
    }
  }

  return NextResponse.json({ ok: true, client: data });
}
