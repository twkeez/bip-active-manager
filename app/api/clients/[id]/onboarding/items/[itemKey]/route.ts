import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildOnboardingEvaluations,
  patchOnboardingItem,
} from "@/lib/clients/onboarding";
import type { ClientRow } from "@/lib/types/client";

type PatchBody = {
  done?: boolean;
  notes?: string | null;
};

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemKey: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.id);
  const itemKey = decodeURIComponent(params.itemKey ?? "").trim();
  if (!clientId || !itemKey) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await patchOnboardingItem(supabase, clientId, itemKey, body, user.id);
  } catch (patchError) {
    return NextResponse.json(
      {
        error:
          patchError instanceof Error ? patchError.message : "Failed to update item.",
      },
      { status: 400 },
    );
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
  return NextResponse.json({ ok: true, evaluation });
}
