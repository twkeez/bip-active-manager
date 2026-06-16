import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSeoOpsEvaluation } from "@/lib/seo/ops/load";
import { patchSeoOpsItem } from "@/lib/seo/ops/store";
import type { SeoOpsCadence } from "@/lib/seo/ops/types";
import type { ClientRow } from "@/lib/types/client";

type PatchBody = {
  done?: boolean;
  notes?: string | null;
  viewed?: boolean;
  cadence?: SeoOpsCadence;
};

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string; itemKey: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.clientId ?? "");
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

  const cadence = body.cadence === "monthly" ? "monthly" : "weekly";
  if (cadence !== "weekly" && cadence !== "monthly") {
    return NextResponse.json({ error: "Unsupported cadence" }, { status: 400 });
  }

  try {
    await patchSeoOpsItem(
      supabase,
      clientId,
      itemKey,
      cadence,
      {
        done: body.done,
        notes: body.notes,
        viewed: body.viewed,
      },
      user.id,
    );
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

  const evaluation = await buildSeoOpsEvaluation(supabase, clientRaw as ClientRow);
  return NextResponse.json({ ok: true, evaluation });
}
