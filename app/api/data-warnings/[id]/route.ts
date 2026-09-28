import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark a data warning resolved (admin). It reopens by itself if the same kind
 * of read is cut short again, so resolving it is a claim the next run tests.
 */
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const warningId = Number(id);
  if (!Number.isInteger(warningId) || warningId <= 0) {
    return NextResponse.json({ error: "Invalid warning ID" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("data_warnings")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", warningId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
