import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Marking a watched thread done, for the ones answered by phone or email where
 * Basecamp will never show a reply. Putting one back is the same call with
 * state "open", since the usual reason for marking something done by mistake
 * is that it was answered somewhere else and then came back.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid item" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const reopening = payload?.state === "open";
  const now = new Date().toISOString();

  const { error } = await createAdminClient()
    .from("basecamp_watch_items")
    .update(
      reopening
        ? { state: "open", resolution: null, resolved_at: null, resolved_by: null, updated_at: now }
        : {
            state: "resolved",
            resolution: "marked_done",
            resolved_at: now,
            resolved_by: user.email ?? null,
            updated_at: now,
          },
    )
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
