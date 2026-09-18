import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { loadRoutineViews } from "@/lib/routines/load";

/** Every routine, when it runs next, and its recent runs. Admin-only. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const { routines, error } = await loadRoutineViews(createAdminClient());
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ routines });
}
