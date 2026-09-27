import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AcknowledgeRequest = {
  clientId?: number;
  /**
   * The client message being dismissed (the Response Report sends the
   * project's last client message). The dismissal covers at least this, so the
   * row moves even if the client's aggregate lags behind the project.
   */
  forOccurredAt?: string;
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
  const requested = body.forOccurredAt ? new Date(body.forOccurredAt) : null;
  const requestedMs =
    requested && !Number.isNaN(requested.getTime()) && requested.getTime() <= Date.now()
      ? requested.getTime()
      : null;
  const aggregateMs = current.last_communication_at ? new Date(current.last_communication_at).getTime() : null;
  const coversMs = Math.max(requestedMs ?? -Infinity, aggregateMs ?? -Infinity);
  const coversIso = Number.isFinite(coversMs) ? new Date(coversMs).toISOString() : null;
  const { data: updated, error: updateError } = await supabase
    .from("clients")
    .update({
      reply_acknowledged_at: nowIso,
      reply_acknowledged_for_occurred_at: coversIso,
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

/**
 * Undo a dismissal: the client's last message counts as waiting on us again.
 * needs_reply goes back to whether the client spoke last; the next sync
 * recomputes it anyway.
 */
export async function DELETE(request: Request) {
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
    .select("id,last_event_is_internal")
    .eq("id", clientId)
    .single<{ id: number; last_event_is_internal: boolean | null }>();
  if (selectError || !current) {
    return NextResponse.json({ error: selectError?.message ?? "Client not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("clients")
    .update({
      reply_acknowledged_at: null,
      reply_acknowledged_for_occurred_at: null,
      needs_reply: current.last_event_is_internal === false,
    })
    .eq("id", clientId)
    .select("*")
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to undo the dismissal" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, client: updated });
}
