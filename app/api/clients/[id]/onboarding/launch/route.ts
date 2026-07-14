import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Mark (or un-mark) the client's website as launched. This flips the deferred
// at_launch onboarding steps active.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.id);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let launched = true;
  try {
    const body = (await request.json()) as { launched?: boolean };
    if (typeof body.launched === "boolean") launched = body.launched;
  } catch {
    // default to marking launched
  }

  const { data: clientRaw, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!clientRaw) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error: upsertError } = await supabase.from("client_onboarding_intake").upsert(
    {
      client_id: clientId,
      website_launched_at: launched ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [clientRaw as ClientRow]);
  return NextResponse.json({ ok: true, evaluation });
}
