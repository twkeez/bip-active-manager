import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AcknowledgeRequest = {
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

  let body: AcknowledgeRequest;
  try {
    body = (await request.json()) as AcknowledgeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const { data: current, error: selectError } = await supabase
    .from("clients")
    .select("id,last_communication_at")
    .eq("id", clientId)
    .single<{ id: number; last_communication_at: string | null }>();
  if (selectError || !current) {
    return NextResponse.json(
      { error: selectError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("clients")
    .update({
      reply_acknowledged_at: nowIso,
      reply_acknowledged_for_occurred_at: current.last_communication_at,
      needs_reply: false,
    })
    .eq("id", clientId)
    .select("*")
    .single();
  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to acknowledge client" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, client: updated });
}
