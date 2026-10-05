import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { buildDailyBrief, saveDailyBrief } from "@/lib/daily-brief/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Rebuild today's daily brief on demand. Admins only; the scheduled routine
 * does the same thing every weekday morning. A second run the same day
 * replaces the first.
 */

// Reading every active client takes a while.
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  try {
    const admin = createAdminClient();
    const brief = await buildDailyBrief(admin);
    await saveDailyBrief(admin, brief);
    return NextResponse.json({ ok: true, date: brief.date, clients: brief.clients.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The brief could not be rebuilt." },
      { status: 500 },
    );
  }
}
