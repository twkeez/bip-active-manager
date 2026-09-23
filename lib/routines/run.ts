import type { SupabaseClient } from "@supabase/supabase-js";
import { runBasecampReview } from "@/lib/routines/kinds/basecamp-review";
import { runBasecampWatch } from "@/lib/routines/kinds/basecamp-watch";
import { runClientWatch } from "@/lib/routines/kinds/client-watch";
import { isDue } from "@/lib/routines/schedule";
import type { RoutineResult, RoutineRow, RoutineRunRow } from "@/lib/routines/types";

/**
 * Running routines and keeping a record of every run.
 *
 * The record is the point as much as the run: "did the review happen this
 * morning, and what did it say?" has to be answerable without trusting that a
 * job fired. A run is written as started before the work begins and finished
 * after, so a run that crashed mid-way shows as unfinished rather than
 * vanishing.
 */

type Runner = (supabase: SupabaseClient, settings: Record<string, unknown>, now: Date) => Promise<RoutineResult>;

/** Every kind of routine the app knows how to run. */
export const RUNNERS: Record<string, { label: string; run: Runner }> = {
  basecamp_review: { label: "Basecamp review", run: runBasecampReview },
  basecamp_watch: { label: "Basecamp watch", run: runBasecampWatch },
  client_watch: { label: "Client watch", run: runClientWatch },
};

export async function runRoutine(
  admin: SupabaseClient,
  routine: RoutineRow,
  trigger: RoutineRunRow["trigger"],
  now: Date = new Date(),
): Promise<RoutineRunRow> {
  const { data: started, error: startError } = await admin
    .from("routine_runs")
    .insert({ routine_id: routine.id, trigger, started_at: now.toISOString() })
    .select("*")
    .single<RoutineRunRow>();
  if (startError || !started) throw new Error(startError?.message ?? "Could not record the run");

  let status: RoutineRunRow["status"];
  let headline: string;
  let findings: RoutineRunRow["findings"] = [];
  let errorMessage: string | null = null;

  const runner = RUNNERS[routine.kind];
  try {
    if (!runner) throw new Error(`No runner for routine kind "${routine.kind}"`);
    const result = await runner.run(admin, routine.settings ?? {}, now);
    status = result.status;
    headline = result.headline;
    findings = result.findings;
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "The routine failed";
    headline = `Could not run: ${errorMessage}`;
  }

  const finishedAt = new Date().toISOString();
  const { data: finished } = await admin
    .from("routine_runs")
    .update({ finished_at: finishedAt, status, headline, findings, error_message: errorMessage })
    .eq("id", started.id)
    .select("*")
    .single<RoutineRunRow>();

  await admin
    .from("routines")
    .update({ last_run_at: now.toISOString(), last_status: status, last_headline: headline, updated_at: finishedAt })
    .eq("id", routine.id);

  return finished ?? { ...started, finished_at: finishedAt, status, headline, findings, error_message: errorMessage };
}

/**
 * Everything that is due, run once each. One routine failing is recorded
 * against that routine and does not stop the others.
 */
export async function runDueRoutines(admin: SupabaseClient, now: Date = new Date()) {
  const { data, error } = await admin.from("routines").select("*").eq("enabled", true);
  if (error) throw new Error(error.message);

  const due = ((data ?? []) as RoutineRow[]).filter((routine) =>
    isDue(routine.schedule, routine.last_run_at, now),
  );
  const runs: Array<{ key: string; status: RoutineRunRow["status"]; headline: string | null }> = [];
  for (const routine of due) {
    const run = await runRoutine(admin, routine, "schedule", now);
    runs.push({ key: routine.key, status: run.status, headline: run.headline });
  }
  return { considered: (data ?? []).length, ran: runs.length, runs };
}
