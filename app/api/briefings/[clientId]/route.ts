import { NextResponse } from "next/server";
import { loadClientBriefing } from "@/lib/briefing/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";

/**
 * One client's briefing, computed on request.
 *
 * Nothing is stored yet: this is the preview that decides whether the findings
 * are worth sending at all. Admin-only while that is being judged — a note a
 * strategist has not seen the wording of should not reach them by accident.
 */

export async function GET(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId: raw } = await context.params;
  const clientId = Number(raw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  try {
    const briefing = await loadClientBriefing(createAdminClient(), clientId);
    if (!briefing) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ briefing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build the briefing" },
      { status: 500 },
    );
  }
}
