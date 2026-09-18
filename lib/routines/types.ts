import type { RoutineSchedule } from "@/lib/routines/schedule";

/**
 * A routine: something the app does on its own, on a schedule, that a person
 * asked for in their own words.
 *
 * Each routine names a *kind* — the built-in job that does the work — plus its
 * settings. The instruction is kept alongside in the words it was asked in, so
 * anyone reading the list knows what it is for without reading code, and so a
 * routine can be checked against what was asked.
 *
 * Kinds are code, not prompts. A routine that asked Claude to decide afresh on
 * every run would cost money each time and could answer differently twice; the
 * Basecamp thread verdicts are already made by the sync, and the routine only
 * has to read them.
 */

export type RoutineRow = {
  id: number;
  key: string;
  name: string;
  instruction: string;
  kind: string;
  settings: Record<string, unknown>;
  schedule: RoutineSchedule;
  enabled: boolean;
  last_run_at: string | null;
  last_status: RoutineStatus | null;
  last_headline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineStatus = "ok" | "attention" | "error";

/** One thing a run found, grouped under a heading for display. */
export type RoutineFinding = {
  /** The heading it sits under: "Needs a reply from us". */
  group: string;
  label: string;
  /** Secondary line: which client, how long. */
  meta: string;
  href?: string | null;
  /** Worth drawing the eye to: someone chasing, a long wait. */
  flagged?: boolean;
};

export type RoutineResult = {
  status: Exclude<RoutineStatus, "error">;
  headline: string;
  findings: RoutineFinding[];
};

export type RoutineRunRow = {
  id: number;
  routine_id: number;
  trigger: "schedule" | "manual";
  started_at: string;
  finished_at: string | null;
  status: RoutineStatus | null;
  headline: string | null;
  findings: RoutineFinding[];
  error_message: string | null;
};
