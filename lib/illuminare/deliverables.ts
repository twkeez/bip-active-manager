// Deliverable model + the re-engagement follow-up engine for Illuminare clients.
// Kept as pure functions so the reminder logic is unit-tested independently of Supabase.

export type DeliverableKind = "recurring" | "one_time";

export type DeliverableCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type DeliverableStatus = "active" | "completed" | "cancelled";

export type IlluminareDeliverableRow = {
  id: number;
  client_id: number;
  title: string;
  detail: string | null;
  kind: DeliverableKind;
  cadence: DeliverableCadence | null;
  status: DeliverableStatus;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  follow_up_interval_days: number | null;
  follow_up_at: string | null;
  last_followed_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const DELIVERABLE_CADENCES: DeliverableCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

export const CADENCE_LABELS: Record<DeliverableCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

/* -------------------------------------------------------------------------- */
/* Date helpers — operate on plain YYYY-MM-DD to avoid timezone drift.        */
/* -------------------------------------------------------------------------- */

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Signed day difference `aIso - bIso`. Negative means `aIso` is earlier. */
export function diffDaysIso(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

export type DeliverableEvaluation = {
  id: number;
  kind: DeliverableKind;
  status: DeliverableStatus;
  isRecurring: boolean;
  /** one_time still being worked. */
  isOpenOneTime: boolean;
  /** one_time finished (eligible for a re-engagement nudge). */
  isCompletedOneTime: boolean;
  /** A completed one-off whose check-back-in date has arrived. */
  needsFollowUp: boolean;
  /** Days until the next follow-up (negative = overdue), or null if none scheduled. */
  followUpDueInDays: number | null;
  /** Days until an open one-off's due date (negative = past due), or null. */
  dueInDays: number | null;
};

export function evaluateDeliverable(
  row: IlluminareDeliverableRow,
  today: string = todayIso(),
): DeliverableEvaluation {
  const isRecurring = row.kind === "recurring";
  const isOneTime = row.kind === "one_time";
  const isActive = row.status === "active";
  const isCompleted = row.status === "completed";

  const isOpenOneTime = isOneTime && isActive;
  const isCompletedOneTime = isOneTime && isCompleted;

  let followUpDueInDays: number | null = null;
  let needsFollowUp = false;
  if (isCompletedOneTime && row.follow_up_at) {
    followUpDueInDays = diffDaysIso(row.follow_up_at, today);
    needsFollowUp = followUpDueInDays <= 0;
  }

  let dueInDays: number | null = null;
  if (isOpenOneTime && row.due_date) {
    dueInDays = diffDaysIso(row.due_date, today);
  }

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    isRecurring,
    isOpenOneTime,
    isCompletedOneTime,
    needsFollowUp,
    followUpDueInDays,
    dueInDays,
  };
}

export type DeliverablesSummary = {
  recurringActiveCount: number;
  openOneTimeCount: number;
  needsFollowUpCount: number;
  evaluations: Record<number, DeliverableEvaluation>;
};

export function summarizeDeliverables(
  rows: IlluminareDeliverableRow[],
  today: string = todayIso(),
): DeliverablesSummary {
  const evaluations: Record<number, DeliverableEvaluation> = {};
  let recurringActiveCount = 0;
  let openOneTimeCount = 0;
  let needsFollowUpCount = 0;

  for (const row of rows) {
    const evaluation = evaluateDeliverable(row, today);
    evaluations[row.id] = evaluation;
    if (evaluation.isRecurring && row.status === "active") recurringActiveCount += 1;
    if (evaluation.isOpenOneTime) openOneTimeCount += 1;
    if (evaluation.needsFollowUp) needsFollowUpCount += 1;
  }

  return {
    recurringActiveCount,
    openOneTimeCount,
    needsFollowUpCount,
    evaluations,
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations — patches the API applies (kept pure for testing).               */
/* -------------------------------------------------------------------------- */

export type DeliverableCompletionPatch = {
  status: "completed";
  completed_at: string;
  follow_up_interval_days: number | null;
  follow_up_at: string | null;
  updated_at: string;
};

/**
 * Marking a one-off complete: stamp completion and, when a follow-up interval is
 * set, schedule the first re-engagement nudge that many days out.
 */
export function buildCompletionPatch(
  row: Pick<IlluminareDeliverableRow, "follow_up_interval_days">,
  intervalDaysOverride?: number | null,
  now: Date = new Date(),
): DeliverableCompletionPatch {
  const interval =
    intervalDaysOverride !== undefined
      ? intervalDaysOverride
      : row.follow_up_interval_days;
  const hasInterval = typeof interval === "number" && interval > 0;
  return {
    status: "completed",
    completed_at: now.toISOString(),
    follow_up_interval_days: hasInterval ? interval : null,
    follow_up_at: hasInterval ? addDaysIso(todayIso(now), interval) : null,
    updated_at: now.toISOString(),
  };
}

export type DeliverableFollowUpPatch = {
  last_followed_up_at: string;
  follow_up_at: string | null;
  updated_at: string;
};

/**
 * Logging a re-engagement touch: record when we reached out and roll the next
 * nudge forward by the interval, so one-offs prompt an occasional check-in
 * rather than firing once and going silent.
 */
export function buildFollowUpPatch(
  row: Pick<IlluminareDeliverableRow, "follow_up_interval_days">,
  now: Date = new Date(),
): DeliverableFollowUpPatch {
  const interval = row.follow_up_interval_days;
  const hasInterval = typeof interval === "number" && interval > 0;
  return {
    last_followed_up_at: now.toISOString(),
    follow_up_at: hasInterval ? addDaysIso(todayIso(now), interval) : null,
    updated_at: now.toISOString(),
  };
}
