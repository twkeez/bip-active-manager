import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingEvaluations, startOnboardingForClient } from "@/lib/clients/onboarding";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function POST(
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

  try {
    await startOnboardingForClient(supabase, clientId, user.id);
  } catch (startError) {
    return NextResponse.json(
      {
        error:
          startError instanceof Error ? startError.message : "Failed to start onboarding.",
      },
      { status: 500 },
    );
  }

  const { data: updatedRaw } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [
    (updatedRaw ?? clientRaw) as ClientRow,
  ]);

  return NextResponse.json({ ok: true, evaluation });
}
