import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Changes the assistant proposes to your task list — and nothing it can apply
 * by itself.
 *
 * The model only ever produces a proposal. It reaches the database when you
 * press Confirm, through your own login, so row-level security limits it to
 * your tasks regardless of what the conversation said. Every applied change
 * returns the exact inverse, which is what Undo sends back.
 *
 * The input is model output and untrusted: every field is validated here, not
 * assumed from the tool schema.
 */

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
/** "done" is reached through complete, never set directly, so it can be undone cleanly. */
export const EDITABLE_STATUSES = ["not_started", "in_progress", "waiting_on_client"] as const;

type Priority = (typeof TASK_PRIORITIES)[number];
type EditableStatus = (typeof EDITABLE_STATUSES)[number];

export type TaskChange =
  | {
      action: "create";
      title: string;
      notes?: string | null;
      due_date?: string | null;
      priority?: Priority;
      client_id?: number | null;
      reason: string;
    }
  | {
      action: "update";
      task_id: number;
      title?: string;
      notes?: string | null;
      due_date?: string | null;
      priority?: Priority;
      status?: EditableStatus;
      client_id?: number | null;
      reason: string;
    }
  | { action: "complete"; task_id: number; reason: string }
  | { action: "reopen"; task_id: number; reason: string };

/** What Undo sends back: a full restore of changed fields, or removal of a task we created. */
export type UndoOperation =
  | {
      kind: "restore";
      task_id: number;
      fields: {
        title: string;
        notes: string | null;
        due_date: string | null;
        priority: Priority;
        status: string;
        client_id: number | null;
      };
    }
  | { kind: "remove_created"; task_id: number };

export class TaskChangeError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Rejects 2026-02-30, which the pattern alone would accept.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new TaskChangeError(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new TaskChangeError(`${field} is longer than ${max} characters.`);
  return trimmed || null;
}

function taskId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TaskChangeError("task_id must be the id of one of your tasks.");
  }
  return value;
}

/**
 * Turns whatever the model sent into a well-formed change, or throws with a
 * reason the model can act on. Unknown fields are dropped, not trusted.
 */
export function parseTaskChange(raw: unknown): TaskChange {
  if (!raw || typeof raw !== "object") throw new TaskChangeError("Each change must be an object.");
  const input = raw as Record<string, unknown>;

  const reason = optionalText(input.reason, "reason", 500);
  if (!reason) throw new TaskChangeError("Every change needs a reason, so you can see why it was suggested.");

  const dueDate = (() => {
    if (input.due_date === undefined) return undefined;
    if (input.due_date === null) return null;
    if (typeof input.due_date !== "string" || !isValidDate(input.due_date)) {
      throw new TaskChangeError("due_date must be a real date written YYYY-MM-DD, or null to clear it.");
    }
    return input.due_date;
  })();

  const priority = (() => {
    if (input.priority === undefined) return undefined;
    if (!TASK_PRIORITIES.includes(input.priority as Priority)) {
      throw new TaskChangeError(`priority must be one of ${TASK_PRIORITIES.join(", ")}.`);
    }
    return input.priority as Priority;
  })();

  const clientId = (() => {
    if (input.client_id === undefined) return undefined;
    if (input.client_id === null) return null;
    if (typeof input.client_id !== "number" || !Number.isInteger(input.client_id) || input.client_id <= 0) {
      throw new TaskChangeError("client_id must be a client's numeric id, or null.");
    }
    return input.client_id;
  })();

  switch (input.action) {
    case "create": {
      const title = optionalText(input.title, "title", 300);
      if (!title) throw new TaskChangeError("A new task needs a title.");
      return {
        action: "create",
        title,
        notes: optionalText(input.notes, "notes", 4000),
        due_date: dueDate,
        priority,
        client_id: clientId,
        reason,
      };
    }
    case "update": {
      const status = (() => {
        if (input.status === undefined) return undefined;
        if (!EDITABLE_STATUSES.includes(input.status as EditableStatus)) {
          throw new TaskChangeError(
            `status must be one of ${EDITABLE_STATUSES.join(", ")}. Use action "complete" to finish a task.`,
          );
        }
        return input.status as EditableStatus;
      })();
      const title = optionalText(input.title, "title", 300);
      if (title === null) throw new TaskChangeError("A task's title cannot be cleared.");
      const change = {
        action: "update" as const,
        task_id: taskId(input.task_id),
        title,
        notes: optionalText(input.notes, "notes", 4000),
        due_date: dueDate,
        priority,
        status,
        client_id: clientId,
        reason,
      };
      const changesSomething = [change.title, change.notes, change.due_date, change.priority, change.status, change.client_id].some(
        (value) => value !== undefined,
      );
      if (!changesSomething) throw new TaskChangeError("An update has to change at least one field.");
      return change;
    }
    case "complete":
      return { action: "complete", task_id: taskId(input.task_id), reason };
    case "reopen":
      return { action: "reopen", task_id: taskId(input.task_id), reason };
    default:
      throw new TaskChangeError('action must be "create", "update", "complete" or "reopen".');
  }
}

type TaskRow = {
  id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: Priority;
  status: string;
  client_id: number | null;
  source_type: string;
};

const TASK_FIELDS = "id, title, notes, due_date, priority, status, client_id, source_type";

async function loadOwnTask(supabase: SupabaseClient, userId: string, id: number): Promise<TaskRow> {
  // Owner filtered explicitly as well as by row-level security: if this is ever
  // called with a service-role client, it must still only see your tasks.
  const { data, error } = await supabase
    .from("user_tasks")
    .select(TASK_FIELDS)
    .eq("id", id)
    .eq("owner_user_id", userId)
    .maybeSingle<TaskRow>();
  if (error) throw new TaskChangeError(error.message);
  if (!data) throw new TaskChangeError(`Task ${id} is not one of your tasks.`);
  return data;
}

async function assertClientExists(supabase: SupabaseClient, clientId: number | null | undefined) {
  if (clientId === undefined || clientId === null) return;
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!data) throw new TaskChangeError(`There is no client with id ${clientId}.`);
}

function restoreOf(row: TaskRow): UndoOperation {
  return {
    kind: "restore",
    task_id: row.id,
    fields: {
      title: row.title,
      notes: row.notes,
      due_date: row.due_date,
      priority: row.priority,
      status: row.status,
      client_id: row.client_id,
    },
  };
}

/** Undefined means "leave alone", so only fields the change named are written. */
function defined<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export type AppliedChange = { change: TaskChange; taskId: number; title: string; undo: UndoOperation };

/**
 * Applies confirmed changes one at a time, in order. Stops at the first
 * failure and reports what did apply, so a partial run is never a mystery.
 */
export async function applyTaskChanges(
  supabase: SupabaseClient,
  userId: string,
  changes: TaskChange[],
): Promise<{ applied: AppliedChange[]; error: string | null }> {
  const applied: AppliedChange[] = [];
  const now = new Date().toISOString();

  try {
    for (const change of changes) {
      if (change.action === "create") {
        await assertClientExists(supabase, change.client_id);
        const { data, error } = await supabase
          .from("user_tasks")
          .insert({
            owner_user_id: userId,
            title: change.title,
            notes: change.notes ?? null,
            due_date: change.due_date ?? null,
            priority: change.priority ?? "medium",
            status: "not_started",
            client_id: change.client_id ?? null,
            source_type: "assistant",
          })
          .select(TASK_FIELDS)
          .single<TaskRow>();
        if (error || !data) throw new TaskChangeError(error?.message ?? "The task was not created.");
        applied.push({ change, taskId: data.id, title: data.title, undo: { kind: "remove_created", task_id: data.id } });
        continue;
      }

      const before = await loadOwnTask(supabase, userId, change.task_id);
      let patch: Record<string, unknown>;
      if (change.action === "complete") {
        patch = { status: "done" };
      } else if (change.action === "reopen") {
        patch = { status: "not_started" };
      } else {
        await assertClientExists(supabase, change.client_id);
        patch = defined({
          title: change.title,
          notes: change.notes,
          due_date: change.due_date,
          priority: change.priority,
          status: change.status,
          client_id: change.client_id,
        });
      }

      const { error } = await supabase
        .from("user_tasks")
        .update({ ...patch, updated_at: now })
        .eq("id", change.task_id)
        .eq("owner_user_id", userId);
      if (error) throw new TaskChangeError(error.message);
      applied.push({ change, taskId: before.id, title: before.title, undo: restoreOf(before) });
    }
    return { applied, error: null };
  } catch (error) {
    return { applied, error: error instanceof Error ? error.message : "The change could not be applied." };
  }
}

/** Reverses applied changes, newest first, so a task changed twice lands back where it began. */
export async function undoTaskChanges(
  supabase: SupabaseClient,
  userId: string,
  operations: UndoOperation[],
): Promise<{ undone: number; error: string | null }> {
  let undone = 0;
  const now = new Date().toISOString();
  try {
    for (const operation of [...operations].reverse()) {
      if (operation.kind === "remove_created") {
        // Only a task the assistant made, and only yours: Undo must never be a
        // way to delete something you typed.
        const { error } = await supabase
          .from("user_tasks")
          .delete()
          .eq("id", operation.task_id)
          .eq("owner_user_id", userId)
          .eq("source_type", "assistant");
        if (error) throw new TaskChangeError(error.message);
      } else {
        const { error } = await supabase
          .from("user_tasks")
          .update({ ...operation.fields, updated_at: now })
          .eq("id", operation.task_id)
          .eq("owner_user_id", userId);
        if (error) throw new TaskChangeError(error.message);
      }
      undone += 1;
    }
    return { undone, error: null };
  } catch (error) {
    return { undone, error: error instanceof Error ? error.message : "Undo failed." };
  }
}

/** Validates an Undo payload coming back from the browser. */
export function parseUndoOperation(raw: unknown): UndoOperation {
  if (!raw || typeof raw !== "object") throw new TaskChangeError("Bad undo payload.");
  const input = raw as Record<string, unknown>;
  const id = taskId(input.task_id);
  if (input.kind === "remove_created") return { kind: "remove_created", task_id: id };
  if (input.kind !== "restore" || !input.fields || typeof input.fields !== "object") {
    throw new TaskChangeError("Bad undo payload.");
  }
  const fields = input.fields as Record<string, unknown>;
  const title = optionalText(fields.title, "title", 300);
  if (!title) throw new TaskChangeError("Bad undo payload.");
  if (!TASK_PRIORITIES.includes(fields.priority as Priority)) throw new TaskChangeError("Bad undo payload.");
  if (!["not_started", "in_progress", "waiting_on_client", "done"].includes(fields.status as string)) {
    throw new TaskChangeError("Bad undo payload.");
  }
  const dueDate = fields.due_date;
  if (dueDate !== null && (typeof dueDate !== "string" || !isValidDate(dueDate))) {
    throw new TaskChangeError("Bad undo payload.");
  }
  const clientId = fields.client_id;
  if (clientId !== null && (typeof clientId !== "number" || !Number.isInteger(clientId))) {
    throw new TaskChangeError("Bad undo payload.");
  }
  return {
    kind: "restore",
    task_id: id,
    fields: {
      title,
      notes: optionalText(fields.notes, "notes", 4000) ?? null,
      due_date: dueDate as string | null,
      priority: fields.priority as Priority,
      status: fields.status as string,
      client_id: clientId as number | null,
    },
  };
}
