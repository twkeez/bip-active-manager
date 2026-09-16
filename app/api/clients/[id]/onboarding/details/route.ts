import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { syncOnboardingItemsToServices } from "@/lib/clients/onboarding";
import {
  clientFieldsFromDetails,
  DetailsError,
  intakeFieldsFromDetails,
  parseDetails,
  SERVICE_KEYS,
} from "@/lib/onboarding/onboarding-details";
import { createClient } from "@/lib/supabase/server";

/** Saves the confirmed details for a client already being onboarded. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const clientId = Number((await context.params).id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let details;
  try {
    details = parseDetails(await request.json().catch(() => null));
  } catch (error) {
    return NextResponse.json({ error: error instanceof DetailsError ? error.message : "Invalid details" }, { status: 400 });
  }

  const { data: before } = await supabase.from("clients").select("seo, ppc, smm, blog, orm").eq("id", clientId).maybeSingle();
  if (!before) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { error: clientError } = await supabase.from("clients").update(clientFieldsFromDetails(details)).eq("id", clientId);
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });

  const now = new Date().toISOString();
  const { error: intakeError } = await supabase
    .from("client_onboarding_intake")
    .upsert({ client_id: clientId, ...intakeFieldsFromDetails(details), updated_at: now }, { onConflict: "client_id" });
  if (intakeError) return NextResponse.json({ error: intakeError.message }, { status: 500 });

  // Same rule as the client page: when services change, the (now hidden)
  // onboarding steps are reconciled so Coal Mines and the assistant stay right.
  const servicesChanged = SERVICE_KEYS.some(
    (key) => ((before as Record<string, unknown>)[key] ?? "N") !== details.services[key],
  );
  if (servicesChanged) await syncOnboardingItemsToServices(supabase, clientId);

  return NextResponse.json({ ok: true });
}
