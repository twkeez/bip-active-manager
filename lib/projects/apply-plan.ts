import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientProjectPlanJson, PlanApplyPreview } from "@/lib/types/client";
import { listProjectPhases } from "@/lib/projects/access";
import { syncPhaseProgressFromTasks } from "@/lib/projects/phase-progress";
import { listTaskCategories } from "@/lib/tasks/categories";
import {
  isUserTaskPriority,
  normalizeTaskDueDate,
  normalizeTaskNotes,
  normalizeTaskTitle,
} from "@/lib/tasks/shared";

const PROJECT_CATEGORY_NAME = "Project";

function taskKey(phaseTitle: string, taskTitle: string) {
  return `${phaseTitle.trim().toLowerCase()}::${taskTitle.trim().toLowerCase()}`;
}

async function ensureProjectCategory(supabase: SupabaseClient, userId: string) {
  const categories = await listTaskCategories(supabase, userId);
  const existing = categories.find(
    (category) => category.name.toLowerCase() === PROJECT_CATEGORY_NAME.toLowerCase(),
  );
  if (existing) return existing.id;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_task_categories")
    .insert({
      owner_user_id: userId,
      name: PROJECT_CATEGORY_NAME,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (error) {
    const retry = categories.find(
      (category) => category.name.toLowerCase() === PROJECT_CATEGORY_NAME.toLowerCase(),
    );
    if (retry) return retry.id;
    throw error;
  }
  return (data as { id: number }).id;
}

async function ensurePhasesForPlan(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: number;
  plan: ClientProjectPlanJson;
}) {
  const { supabase, userId, projectId, plan } = params;
  const existingPhases = await listProjectPhases(supabase, userId, projectId);
  const phasesByTitle = new Map(
    existingPhases.map((phase) => [phase.title.trim().toLowerCase(), phase]),
  );

  const nowIso = new Date().toISOString();
  let sortOrder = existingPhases.length;
  let phasesCreated = 0;

  for (const phase of plan.phases) {
    const key = phase.title.trim().toLowerCase();
    if (!phasesByTitle.has(key)) {
      const { data: inserted, error } = await supabase
        .from("client_project_phases")
        .insert({
          project_id: projectId,
          owner_user_id: userId,
          title: phase.title.trim(),
          sort_order: sortOrder,
          status: "not_started",
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id,title,sort_order,status,notes,project_id,owner_user_id,created_at,updated_at")
        .single();
      if (error) throw error;
      phasesByTitle.set(key, inserted as (typeof existingPhases)[number]);
      sortOrder += 1;
      phasesCreated += 1;
    }
  }

  return { phasesByTitle, phasesCreated, phasesExisting: existingPhases.length };
}

async function loadExistingPlanTasks(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data, error } = await supabase
    .from("user_tasks")
    .select("id,title,phase_id,status,priority,due_date,notes,source_type")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId);
  if (error) throw error;

  const { data: phasesRaw } = await supabase
    .from("client_project_phases")
    .select("id,title")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId);

  const phaseTitleById = new Map(
    (phasesRaw ?? []).map((phase) => [
      (phase as { id: number }).id,
      (phase as { title: string }).title,
    ]),
  );

  const byKey = new Map<string, (typeof data extends Array<infer T> ? T : never)>();
  for (const row of data ?? []) {
    const task = row as {
      id: number;
      title: string;
      phase_id: number | null;
    };
    const phaseTitle =
      task.phase_id != null ? phaseTitleById.get(task.phase_id) ?? "" : "";
    byKey.set(taskKey(phaseTitle, task.title), row as never);
  }
  return byKey;
}

export async function previewProjectPlan(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: number;
  plan: ClientProjectPlanJson;
}): Promise<PlanApplyPreview> {
  const { supabase, userId, projectId, plan } = params;
  const existingPhases = await listProjectPhases(supabase, userId, projectId);
  const phasesByTitle = new Map(
    existingPhases.map((phase) => [phase.title.trim().toLowerCase(), phase.title]),
  );

  const existingTasks = await loadExistingPlanTasks(supabase, userId, projectId);

  const phasesToCreate: string[] = [];
  const tasksToCreate: PlanApplyPreview["tasksToCreate"] = [];
  const tasksToUpdate: PlanApplyPreview["tasksToUpdate"] = [];
  let tasksSkipped = 0;

  for (const phase of plan.phases) {
    const phaseTitle = phase.title.trim();
    const key = phaseTitle.toLowerCase();
    if (!phasesByTitle.has(key)) {
      phasesToCreate.push(phaseTitle);
    }

    for (const task of phase.tasks) {
      const title = normalizeTaskTitle(task.title);
      if (!title) continue;
      const match = existingTasks.get(taskKey(phaseTitle, title));
      if (!match) {
        tasksToCreate.push({ title, phaseTitle });
        continue;
      }
      const row = match as {
        priority: string;
        due_date: string | null;
        notes: string | null;
      };
      const priority = isUserTaskPriority(task.priority) ? task.priority : "medium";
      const dueDate = normalizeTaskDueDate(task.dueDate);
      const notes = normalizeTaskNotes(task.notes);
      const needsUpdate =
        row.priority !== priority ||
        (dueDate && row.due_date !== dueDate) ||
        (notes && !row.notes);
      if (needsUpdate) {
        tasksToUpdate.push({ title, phaseTitle });
      } else {
        tasksSkipped += 1;
      }
    }
  }

  return {
    phasesToCreate,
    phasesExisting: existingPhases.length,
    tasksToCreate,
    tasksToUpdate,
    tasksSkipped,
  };
}

export async function applyProjectPlan(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: number;
  clientId: number | null;
  plan: ClientProjectPlanJson;
  mode?: "merge" | "replace";
}) {
  const { supabase, userId, projectId, clientId, plan, mode = "merge" } = params;
  const nowIso = new Date().toISOString();

  if (mode === "replace") {
    const { error: deleteError } = await supabase
      .from("user_tasks")
      .delete()
      .eq("owner_user_id", userId)
      .eq("project_id", projectId)
      .eq("source_type", "plan");
    if (deleteError) throw deleteError;
  }

  const { phasesByTitle, phasesCreated, phasesExisting } = await ensurePhasesForPlan({
    supabase,
    userId,
    projectId,
    plan,
  });

  const existingTasks =
    mode === "replace"
      ? new Map<string, never>()
      : await loadExistingPlanTasks(supabase, userId, projectId);

  const categoryId = await ensureProjectCategory(supabase, userId);
  const taskRows: Array<Record<string, unknown>> = [];
  let tasksUpdated = 0;

  for (const phase of plan.phases) {
    const phaseRow = phasesByTitle.get(phase.title.trim().toLowerCase());
    const phaseId = phaseRow?.id ?? null;

    for (const task of phase.tasks) {
      const title = normalizeTaskTitle(task.title);
      if (!title) continue;
      const priority = isUserTaskPriority(task.priority) ? task.priority : "medium";
      const dueDate = normalizeTaskDueDate(task.dueDate);
      const notes = normalizeTaskNotes(task.notes);

      const existing = existingTasks.get(taskKey(phase.title, title)) as
        | {
            id: number;
            priority: string;
            due_date: string | null;
            notes: string | null;
            phase_id: number | null;
          }
        | undefined;

      if (existing) {
        const patch: Record<string, unknown> = { updated_at: nowIso };
        if (existing.priority !== priority) patch.priority = priority;
        if (dueDate && existing.due_date !== dueDate) patch.due_date = dueDate;
        if (notes && !existing.notes) {
          patch.notes = notes;
          patch.description = notes;
        }
        if (phaseId != null && existing.phase_id !== phaseId) {
          patch.phase_id = phaseId;
        }
        if (Object.keys(patch).length > 1) {
          const { error } = await supabase
            .from("user_tasks")
            .update(patch)
            .eq("id", existing.id)
            .eq("owner_user_id", userId);
          if (error) throw error;
          tasksUpdated += 1;
        }
        continue;
      }

      taskRows.push({
        owner_user_id: userId,
        title,
        notes,
        description: notes,
        status: "not_started",
        priority,
        due_date: dueDate,
        category_id: categoryId,
        client_id: clientId,
        project_id: projectId,
        phase_id: phaseId,
        is_starred: false,
        source_type: "plan",
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  let tasksCreated = 0;
  if (taskRows.length) {
    const { data: insertedTasks, error: taskError } = await supabase
      .from("user_tasks")
      .insert(taskRows)
      .select("id");
    if (taskError) throw taskError;
    tasksCreated = (insertedTasks ?? []).length;
  }

  await supabase
    .from("client_projects")
    .update({ updated_at: nowIso, status: "active" })
    .eq("id", projectId)
    .eq("owner_user_id", userId);

  await syncPhaseProgressFromTasks(supabase, userId, projectId);

  return {
    phasesCreated,
    phasesExisting,
    tasksCreated,
    tasksUpdated,
  };
}
