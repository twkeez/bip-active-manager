import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { describeSchedule, nextRun } from "@/lib/routines/schedule";
import type { RoutineRow, RoutineRunRow } from "@/lib/routines/types";

/** Every routine, when it runs next, and its recent runs. Admin-only. */

const RUNS_SHOWN = 10;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const admin = createAdminClient();
  const { data: routines, error } = await admin.from("routines").select("*").order("name");
  if (error) {
    return NextResponse.json(
      {
        error: /does not exist|schema cache/i.test(error.message)
          ? "Routines are not set up yet — the database migration needs running."
          : error.message,
      },
      { status: 500 },
    );
  }

  const now = new Date();
  const withRuns = await Promise.all(
    ((routines ?? []) as RoutineRow[]).map(async (routine) => {
      const { data: runs } = await admin
        .from("routine_runs")
        .select("*")
        .eq("routine_id", routine.id)
        .order("started_at", { ascending: false })
        .limit(RUNS_SHOWN);
      return {
        ...routine,
        scheduleText: describeSchedule(routine.schedule),
        nextRunAt: routine.enabled ? (nextRun(routine.schedule, now)?.toISOString() ?? null) : null,
        runs: (runs ?? []) as RoutineRunRow[],
      };
    }),
  );
  return NextResponse.json({ routines: withRuns });
}
