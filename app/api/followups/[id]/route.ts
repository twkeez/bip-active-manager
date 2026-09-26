import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Mark a follow-up done by hand (handled by phone, say), or reopen it. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId <= 0) {
    return NextResponse.json({ error: "Invalid follow-up ID" }, { status: 400 });
  }

  let action: unknown;
  try {
    ({ action } = (await request.json()) as { action?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch =
    action === "done"
      ? {
          state: "done",
          resolution: "marked_done",
          resolved_at: new Date().toISOString(),
          resolved_by: user.email ?? user.id,
        }
      : action === "reopen"
        ? { state: "open", resolution: null, resolved_at: null, resolved_by: null }
        : null;
  if (!patch) {
    return NextResponse.json({ error: 'action must be "done" or "reopen"' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("strategist_followups")
    .update(patch)
    .eq("id", followupId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
  return NextResponse.json({ ok: true, followup: data });
}
