import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTaskCategories } from "@/lib/tasks/categories";
import type {
  UserTaskAssignee,
  UserTaskAttachment,
  UserTaskLink,
  UserTaskPerson,
  TaskClientOption,
  UserTask,
  UserTaskCategory,
  UserTaskSource,
  UserTaskStatus,
} from "@/lib/types/client";
import {
  isUserTaskPriority,
  joinTasksWithSources,
  normalizeTaskDueDate,
  normalizeTaskNotes,
  normalizeTaskTitle,
} from "@/lib/tasks/shared";
import { normalizeIncomingTaskStatus } from "@/lib/tasks/stages";
import { resolveTaskProjectPhase } from "@/lib/tasks/project-link";
import { syncPhaseProgressFromTasks } from "@/lib/projects/phase-progress";

type UpdateTaskBody = {
  title?: string;
  notes?: string | null;
  description?: string | null;
  status?: UserTaskStatus | "inbox";
  priority?: "low" | "medium" | "high";
  dueDate?: string | null;
  categoryId?: number | null;
  clientId?: number | null;
  projectId?: number | null;
  phaseId?: number | null;
  isStarred?: boolean;
};

function parseTaskId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = parseTaskId(params.id);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existingTaskRaw } = await supabase
    .from("user_tasks")
    .select("project_id")
    .eq("id", taskId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const previousProjectId =
    (existingTaskRaw as { project_id: number | null } | null)?.project_id ?? null;

  let body: UpdateTaskBody;
  try {
    body = (await request.json()) as UpdateTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = normalizeTaskTitle(body.title);
    if (!title) {
      return NextResponse.json({ error: "Task title cannot be empty" }, { status: 400 });
    }
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    patch.notes = normalizeTaskNotes(body.notes);
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    patch.description = normalizeTaskNotes(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = normalizeIncomingTaskStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
    }
    patch.status = status;
  }
  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    if (!isUserTaskPriority(body.priority)) {
      return NextResponse.json({ error: "Invalid task priority" }, { status: 400 });
    }
    patch.priority = body.priority;
  }
  if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
    const dueDate = normalizeTaskDueDate(body.dueDate);
    if (body.dueDate != null && !dueDate) {
      return NextResponse.json({ error: "Invalid due date format" }, { status: 400 });
    }
    patch.due_date = dueDate;
  }
  let categories: UserTaskCategory[] = [];
  if (Object.prototype.hasOwnProperty.call(body, "categoryId")) {
    const categoryId =
      body.categoryId == null
        ? null
        : Number.isInteger(body.categoryId) && body.categoryId > 0
          ? body.categoryId
          : null;
    if (body.categoryId != null && categoryId == null) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }
    try {
      categories = await listTaskCategories(supabase, user.id);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to validate category",
        },
        { status: 500 },
      );
    }
    if (categoryId != null && !categories.some((category) => category.id === categoryId)) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    patch.category_id = categoryId;
  }
  if (Object.prototype.hasOwnProperty.call(body, "clientId")) {
    const clientId =
      body.clientId == null
        ? null
        : Number.isInteger(body.clientId) && body.clientId > 0
          ? body.clientId
          : null;
    if (body.clientId != null && clientId == null) {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    patch.client_id = clientId;
  }

  const hasProjectField =
    Object.prototype.hasOwnProperty.call(body, "projectId") ||
    Object.prototype.hasOwnProperty.call(body, "phaseId");
  if (hasProjectField) {
    const link = await resolveTaskProjectPhase({
      supabase,
      userId: user.id,
      projectId: Object.prototype.hasOwnProperty.call(body, "projectId")
        ? body.projectId
        : previousProjectId,
      phaseId: body.phaseId,
      clientId:
        typeof patch.client_id === "number" || patch.client_id === null
          ? (patch.client_id as number | null)
          : undefined,
      hasProjectIdField: Object.prototype.hasOwnProperty.call(body, "projectId"),
      hasPhaseIdField: Object.prototype.hasOwnProperty.call(body, "phaseId"),
    });
    if ("error" in link) {
      return NextResponse.json({ error: link.error }, { status: link.status });
    }
    if (Object.prototype.hasOwnProperty.call(body, "projectId")) {
      patch.project_id = link.projectId;
      if (link.projectId == null) {
        patch.phase_id = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "phaseId")) {
      patch.phase_id = link.phaseId;
      if (link.projectId != null) {
        patch.project_id = link.projectId;
      }
    }
    if (link.clientId != null && !Object.prototype.hasOwnProperty.call(patch, "client_id")) {
      patch.client_id = link.clientId;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "isStarred")) {
    patch.is_starred = body.isStarred === true;
  }

  const { data: updatedRaw, error: updateError } = await supabase
    .from("user_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("owner_user_id", user.id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedRaw) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = updatedRaw as UserTask;
  const nextProjectId = task.project_id;
  const projectsToSync = new Set<number>();
  if (previousProjectId != null) projectsToSync.add(previousProjectId);
  if (nextProjectId != null) projectsToSync.add(nextProjectId);
  for (const projectId of projectsToSync) {
    await syncPhaseProgressFromTasks(supabase, user.id, projectId);
  }

  const { data: sourceRaw } = await supabase
    .from("user_task_sources")
    .select("*")
    .eq("task_id", task.id)
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (categories.length === 0) {
    categories = await listTaskCategories(supabase, user.id);
  }
  let clients: TaskClientOption[] = [];
  if (task.client_id != null) {
    const { data: clientsRaw } = await supabase
      .from("clients")
      .select("id,account_name")
      .eq("id", task.client_id)
      .limit(1);
    clients = (clientsRaw ?? []) as TaskClientOption[];
  }

  const { data: assigneeRowsRaw } = await supabase
    .from("user_task_assignees")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id);
  const assigneeRows = (assigneeRowsRaw ?? []) as UserTaskAssignee[];
  const { data: peopleRaw } = await supabase
    .from("user_task_people")
    .select("*")
    .eq("owner_user_id", user.id);
  const peopleById = new Map<number, UserTaskPerson>(
    ((peopleRaw ?? []) as UserTaskPerson[]).map((person) => [person.id, person]),
  );
  const assigneesByTask: Record<number, UserTaskPerson[]> = {};
  for (const row of assigneeRows) {
    const person = peopleById.get(row.person_id);
    if (!person) continue;
    if (!assigneesByTask[row.task_id]) assigneesByTask[row.task_id] = [];
    assigneesByTask[row.task_id]!.push(person);
  }

  const { data: linksRaw } = await supabase
    .from("user_task_links")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id)
    .order("created_at", { ascending: false });
  const { data: attachmentsRaw } = await supabase
    .from("user_task_attachments")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id)
    .order("created_at", { ascending: false });
  const linksByTask = {
    [task.id]: (linksRaw ?? []) as UserTaskLink[],
  };
  const attachmentsByTask = {
    [task.id]: (attachmentsRaw ?? []) as UserTaskAttachment[],
  };

  const result = joinTasksWithSources(
    [task],
    sourceRaw ? ([sourceRaw as UserTaskSource] as UserTaskSource[]) : [],
    categories,
    clients,
    assigneesByTask,
    linksByTask,
    attachmentsByTask,
  )[0];
  return NextResponse.json({ task: result });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = parseTaskId(params.id);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("user_tasks")
    .delete()
    .eq("id", taskId)
    .eq("owner_user_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
