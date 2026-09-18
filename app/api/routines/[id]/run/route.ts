import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { runRoutine } from "@/lib/routines/run";
import type { RoutineRow } from "@/lib/routines/types";

/** Run one routine now, outside its schedule. Recorded as a manual run. */

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid routine" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const admin = createAdminClient();
  const { data: routine } = await admin.from("routines").select("*").eq("id", id).maybeSingle();
  if (!routine) return NextResponse.json({ error: "Routine not found" }, { status: 404 });

  try {
    const run = await runRoutine(admin, routine as RoutineRow, "manual");
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run the routine" },
      { status: 500 },
    );
  }
}
