import type { SupabaseClient } from "@supabase/supabase-js";
import { describeSchedule, nextRun } from "@/lib/routines/schedule";
import type { RoutineRow, RoutineRunRow } from "@/lib/routines/types";

/**
 * Every routine as a screen shows it: its schedule in words, when it runs
 * next, and its recent runs. Shared by the Coal Mines page and the routines
 * API so the two cannot describe the same routine differently.
 */

export const RUNS_SHOWN = 10;

export type RoutineView = RoutineRow & {
  scheduleText: string;
  nextRunAt: string | null;
  runs: RoutineRunRow[];
};

export async function loadRoutineViews(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ routines: RoutineView[]; error: string | null }> {
  const { data, error } = await admin.from("routines").select("*").order("name");
  if (error) {
    return {
      routines: [],
      error: /does not exist|schema cache/i.test(error.message)
        ? "Routines are not set up yet — the database migration needs running."
        : error.message,
    };
  }

  const routines = await Promise.all(
    ((data ?? []) as RoutineRow[]).map(async (routine) => {
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
  return { routines, error: null };
}
