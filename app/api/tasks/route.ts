import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureDefaultTaskCategories,
  listTaskCategories,
} from "@/lib/tasks/categories";
import type {
  TaskClientOption,
  UserTaskAttachment,
  UserTaskAssignee,
  UserTask,
  UserTaskCategory,
  UserTaskLink,
  UserTaskPerson,
  UserTaskSource,
  UserTaskStatus,
} from "@/lib/types/client";
import { normalizeIncomingTaskStatus } from "@/lib/tasks/stages";
import {
  isUserTaskPriority,
  joinTasksWithSources,
  normalizeTaskDueDate,
  normalizeTaskNotes,
  normalizeTaskTitle,
} from "@/lib/tasks/shared";
import { ensureFixedTaskPeople } from "@/lib/tasks/people";
import { resolveTaskProjectPhase } from "@/lib/tasks/project-link";
import { syncPhaseProgressFromTasks } from "@/lib/projects/phase-progress";

type CreateTaskBody = {
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

async function fetchTaskSources(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tasks: UserTask[],
) {
  const taskIds = tasks.map((task) => task.id);
  if (!taskIds.length) return [] as UserTaskSource[];
  const { data: sourcesRaw, error: sourcesError } = await supabase
    .from("user_task_sources")
    .select("*")
    .eq("owner_user_id", userId)
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });
  if (sourcesError) throw sourcesError;
  return (sourcesRaw ?? []) as UserTaskSource[];
}

async function fetchClients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientIds: number[],
) {
  if (!clientIds.length) return [] as TaskClientOption[];
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id,account_name")
    .in("id", clientIds);
  return (clientsRaw ?? []) as TaskClientOption[];
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tasksRaw, error: tasksError } = await supabase
    .from("user_tasks")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const tasks = (tasksRaw ?? []) as UserTask[];
  let sources: UserTaskSource[] = [];
  let categories: UserTaskCategory[] = [];
  let clients: TaskClientOption[] = [];
  let people: UserTaskPerson[] = [];
  let assigneesByTask: Record<number, UserTaskPerson[]> = {};
  let linksByTask: Record<number, UserTaskLink[]> = {};
  let attachmentsByTask: Record<number, UserTaskAttachment[]> = {};
  try {
    sources = await fetchTaskSources(supabase, user.id, tasks);
    categories = await ensureDefaultTaskCategories(supabase, user.id);
    clients = await fetchClients(
      supabase,
      [...new Set(tasks.map((task) => task.client_id).filter((id): id is number => id != null))],
    );
    const [fixedPeople, assigneesRaw, linksRaw, attachmentsRaw] = await Promise.all([
      ensureFixedTaskPeople(supabase, user.id),
      supabase
        .from("user_task_assignees")
        .select("*")
        .eq("owner_user_id", user.id),
      supabase
        .from("user_task_links")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_task_attachments")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    people = fixedPeople;
    const assigneeRows = (assigneesRaw.data ?? []) as UserTaskAssignee[];
    const peopleById = new Map<number, UserTaskPerson>(people.map((person) => [person.id, person]));
    assigneesByTask = {};
    for (const row of assigneeRows) {
      const person = peopleById.get(row.person_id);
      if (!person) continue;
      if (!assigneesByTask[row.task_id]) assigneesByTask[row.task_id] = [];
      assigneesByTask[row.task_id]!.push(person);
    }
    linksByTask = {};
    for (const link of (linksRaw.data ?? []) as UserTaskLink[]) {
      if (!linksByTask[link.task_id]) linksByTask[link.task_id] = [];
      linksByTask[link.task_id]!.push(link);
    }
    attachmentsByTask = {};
    for (const attachment of (attachmentsRaw.data ?? []) as UserTaskAttachment[]) {
      if (!attachmentsByTask[attachment.task_id]) attachmentsByTask[attachment.task_id] = [];
      attachmentsByTask[attachment.task_id]!.push(attachment);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tasks" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    tasks: joinTasksWithSources(
      tasks,
      sources,
      categories,
      clients,
      assigneesByTask,
      linksByTask,
      attachmentsByTask,
    ),
    categories,
    people,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateTaskBody;
  try {
    body = (await request.json()) as CreateTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = normalizeTaskTitle(body.title);
  if (!title) {
    return NextResponse.json({ error: "Task title is required" }, { status: 400 });
  }

  const status = normalizeIncomingTaskStatus(body.status ?? "not_started") ?? "not_started";
  const priority = body.priority ?? "medium";
  if (!isUserTaskPriority(priority)) {
    return NextResponse.json({ error: "Invalid task priority" }, { status: 400 });
  }

  const dueDate = normalizeTaskDueDate(body.dueDate);
  if (body.dueDate != null && !dueDate) {
    return NextResponse.json({ error: "Invalid due date format" }, { status: 400 });
  }

  const notes = normalizeTaskNotes(body.notes);
  const description = normalizeTaskNotes(body.description);
  const isStarred = body.isStarred === true;
  const categoryId =
    body.categoryId == null ? null : Number.isInteger(body.categoryId) && body.categoryId > 0
      ? body.categoryId
      : null;
  if (body.categoryId != null && categoryId == null) {
    return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
  }
  const clientId =
    body.clientId == null ? null : Number.isInteger(body.clientId) && body.clientId > 0
      ? body.clientId
      : null;
  if (body.clientId != null && clientId == null) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const link = await resolveTaskProjectPhase({
    supabase,
    userId: user.id,
    projectId: body.projectId,
    phaseId: body.phaseId,
    clientId,
    hasProjectIdField: Object.prototype.hasOwnProperty.call(body, "projectId"),
    hasPhaseIdField: Object.prototype.hasOwnProperty.call(body, "phaseId"),
  });
  if ("error" in link) {
    return NextResponse.json({ error: link.error }, { status: link.status });
  }

  let categories: UserTaskCategory[] = [];
  try {
    categories = await listTaskCategories(supabase, user.id);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to validate category",
      },
      { status: 500 },
    );
  }
  if (categoryId != null && !categories.some((category) => category.id === categoryId)) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("user_tasks")
    .insert({
      owner_user_id: user.id,
      title,
      notes,
      description,
      status,
      priority,
      due_date: dueDate,
      category_id: categoryId,
      client_id: link.clientId,
      project_id: link.projectId,
      phase_id: link.phaseId,
      is_starred: isStarred,
      source_type: "manual",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create task" },
      { status: 500 },
    );
  }

  const task = inserted as UserTask;
  if (link.projectId != null) {
    await syncPhaseProgressFromTasks(supabase, user.id, link.projectId);
  }
  const clients = await fetchClients(
    supabase,
    task.client_id == null ? [] : [task.client_id],
  );
  const people = await ensureFixedTaskPeople(supabase, user.id);
  return NextResponse.json({
    task: joinTasksWithSources([task], [], categories, clients)[0],
    people,
  });
}
