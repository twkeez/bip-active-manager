import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildOnboardingEvaluations,
  completeOnboardingForClient,
} from "@/lib/clients/onboarding";
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

  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [
    clientRaw as ClientRow,
  ]);

  try {
    await completeOnboardingForClient(supabase, clientId, evaluation);
  } catch (completeError) {
    return NextResponse.json(
      {
        error:
          completeError instanceof Error
            ? completeError.message
            : "Failed to complete onboarding.",
      },
      { status: 400 },
    );
  }

  const { data: updatedRaw } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  const [updatedEvaluation] = await buildOnboardingEvaluations(supabase, user.id, [
    (updatedRaw ?? clientRaw) as ClientRow,
  ]);

  return NextResponse.json({ ok: true, evaluation: updatedEvaluation });
}
