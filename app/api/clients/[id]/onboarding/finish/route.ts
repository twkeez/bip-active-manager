import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Takes a client off the onboarding list.
 *
 * The older /complete refuses until every checklist step is ticked, and the
 * onboarding page no longer shows the checklist (2026-09-16). Onboarding is
 * done when the Basecamp message is posted and the document is sent — which a
 * person knows and the checklist does not.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const clientId = Number((await context.params).id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { reopen?: boolean };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clients")
    .update(
      body.reopen
        ? { onboarding_status: "active", onboarding_completed_at: null }
        : { onboarding_status: "complete", onboarding_completed_at: now },
    )
    .eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
