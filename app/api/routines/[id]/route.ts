import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { isValidSchedule } from "@/lib/routines/schedule";

/**
 * Pausing a routine, and changing its settings or schedule.
 *
 * Settings are merged, not replaced, so changing one number cannot silently
 * reset the others to defaults.
 */

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid routine" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as
    | { enabled?: unknown; settings?: unknown; schedule?: unknown }
    | null;
  const admin = createAdminClient();
  const { data: current } = await admin.from("routines").select("settings").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Routine not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof payload?.enabled === "boolean") update.enabled = payload.enabled;
  if (payload?.settings && typeof payload.settings === "object") {
    update.settings = { ...((current.settings as Record<string, unknown>) ?? {}), ...(payload.settings as object) };
  }
  if (payload?.schedule !== undefined) {
    if (!isValidSchedule(payload.schedule)) {
      return NextResponse.json({ error: "That is not a valid schedule." }, { status: 400 });
    }
    update.schedule = payload.schedule;
  }

  const { error } = await admin.from("routines").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
