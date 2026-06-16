import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(
  _request: Request,
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

  const { data: clientRaw, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clientRaw) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [
    clientRaw as ClientRow,
  ]);
  return NextResponse.json({ evaluation });
}
