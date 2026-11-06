import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpServer } from "@modelcontextprotocol/server";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { findClient } from "@/lib/poobah/store";
import { PoobahError, todayEastern } from "@/lib/poobah/validate";
import { listTaskCategories } from "@/lib/tasks/categories";
import { resolveTaskProjectPhase } from "@/lib/tasks/project-link";
import { normalizeTaskDueDate, normalizeTaskNotes, normalizeTaskTitle, USER_TASK_PRIORITIES, USER_TASK_STATUSES } from "@/lib/tasks/shared";
import { taskStageLabel } from "@/lib/tasks/stages";
import { filterTasks, isOverdue, sortTasks } from "@/lib/tasks/mcp-filter";
import { batchProjectMeta, getOwnedProject, listProjectLinks, listProjectTasksGrouped } from "@/lib/projects/access";
import { syncPhaseProgressFromTasks } from "@/lib/projects/phase-progress";
import { CLIENT_PROJECT_STATUSES } from "@/lib/projects/shared";
import type { ClientProject, UserTask, UserTaskCategory } from "@/lib/types/client";

// My Tasks and Projects as tools for Claude, on the same connector as Poobah
// Client Watch. Every call acts for the signed-in person only: the same rows
// they see on /my-tasks, filtered by owner_user_id. Claude does the thinking on
// the person's own Claude plan; nothing here calls the Anthropic API. Nothing
// can be deleted from here.

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

function userIdFrom(ctx: Ctx): string {
  const userId = ctx.http?.authInfo?.extra?.userId;
  if (typeof userId !== "string" || !userId) throw new PoobahError("Not signed in. Reconnect the connector.", 400);
  return userId;
}

async function run(ctx: Ctx, work: (userId: string) => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await work(userIdFrom(ctx));
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...(result as object) }, null, 2) }] };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }, null, 2) }] };
  }
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const statusEnum = z.enum(USER_TASK_STATUSES as [UserTask["status"], ...UserTask["status"][]]);
const priorityEnum = z.enum(USER_TASK_PRIORITIES as [UserTask["priority"], ...UserTask["priority"][]]);
const projectStatusEnum = z.enum(CLIENT_PROJECT_STATUSES as [ClientProject["status"], ...ClientProject["status"][]]);
const clientRef = z.union([z.string().min(1), z.number().int().positive()]).describe("A BIP Control client name or client id.");
const dateText = z.string().describe("YYYY-MM-DD.");

async function resolveClientId(admin: SupabaseClient, ref: string | number): Promise<number> {
  const found = await findClient(admin, ref);
  if (!found) throw new PoobahError(`No BIP Control client matches "${ref}".`, 404);
  return found.id;
}

async function resolveCategoryId(admin: SupabaseClient, userId: string, name: string): Promise<number> {
  const categories = await listTaskCategories(admin, userId);
  const wanted = name.trim().toLowerCase();
  const match = categories.find((category) => category.name.trim().toLowerCase() === wanted);
  if (!match) {
    throw new PoobahError(`No task category "${name}". Categories: ${categories.map((c) => c.name).join(", ") || "none"}.`, 404);
  }
  return match.id;
}

function checkedDate(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  const normalized = normalizeTaskDueDate(value);
  if (!normalized) throw new PoobahError(`${field} must be YYYY-MM-DD.`, 400);
  return normalized;
}

async function clientNames(admin: SupabaseClient, ids: (number | null)[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => id != null))];
  if (!unique.length) return new Map();
  const { data, error } = await admin.from("clients").select("id,account_name").in("id", unique);
  if (error) throw error;
  return new Map(((data ?? []) as { id: number; account_name: string }[]).map((row) => [row.id, row.account_name]));
}

async function projectNames(admin: SupabaseClient, userId: string, ids: (number | null)[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => id != null))];
  if (!unique.length) return new Map();
  const { data, error } = await admin.from("client_projects").select("id,name").eq("owner_user_id", userId).in("id", unique);
  if (error) throw error;
  return new Map(((data ?? []) as { id: number; name: string }[]).map((row) => [row.id, row.name]));
}

/** Tasks in a compact, readable shape: names instead of bare ids. */
async function describeTasks(admin: SupabaseClient, userId: string, tasks: UserTask[], categories?: UserTaskCategory[]) {
  const today = todayEastern();
  const [clients, projects, cats] = await Promise.all([
    clientNames(admin, tasks.map((task) => task.client_id)),
    projectNames(admin, userId, tasks.map((task) => task.project_id)),
    categories ? Promise.resolve(categories) : listTaskCategories(admin, userId),
  ]);
  const catById = new Map(cats.map((category) => [category.id, category.name]));
  return tasks.map((task) => ({
    task_id: task.id,
    title: task.title,
    status: task.status,
    status_label: taskStageLabel(task.status),
    priority: task.priority,
    due_date: task.due_date,
    overdue: isOverdue(task, today),
    starred: task.is_starred,
    client: task.client_id != null ? { id: task.client_id, name: clients.get(task.client_id) ?? null } : null,
    project: task.project_id != null ? { id: task.project_id, name: projects.get(task.project_id) ?? null } : null,
    phase_id: task.phase_id,
    category: task.category_id != null ? (catById.get(task.category_id) ?? null) : null,
    notes: task.notes,
    description: task.description,
    source: task.source_type,
    updated_at: task.updated_at,
  }));
}

async function loadTask(admin: SupabaseClient, userId: string, taskId: number): Promise<UserTask> {
  const { data, error } = await admin.from("user_tasks").select("*").eq("id", taskId).eq("owner_user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new PoobahError(`No task ${taskId} on your list.`, 404);
  return data as UserTask;
}

async function syncProjects(admin: SupabaseClient, userId: string, ...projectIds: (number | null)[]) {
  for (const projectId of new Set(projectIds.filter((id): id is number => id != null))) {
    await syncPhaseProgressFromTasks(admin, userId, projectId);
  }
}

type TaskFields = {
  title?: string;
  notes?: string | null;
  description?: string | null;
  status?: UserTask["status"];
  priority?: UserTask["priority"];
  due_date?: string | null;
  starred?: boolean;
  category?: string | null;
  client?: string | number | null;
  project_id?: number | null;
  phase_id?: number | null;
};

export async function updateTask(admin: SupabaseClient, userId: string, taskId: number, fields: TaskFields) {
  const existing = await loadTask(admin, userId, taskId);
  const has = (key: keyof TaskFields) => Object.prototype.hasOwnProperty.call(fields, key);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (has("title")) {
    const title = normalizeTaskTitle(fields.title);
    if (!title) throw new PoobahError("Task title cannot be empty.", 400);
    patch.title = title;
  }
  if (has("notes")) patch.notes = normalizeTaskNotes(fields.notes);
  if (has("description")) patch.description = normalizeTaskNotes(fields.description);
  if (has("status")) patch.status = fields.status;
  if (has("priority")) patch.priority = fields.priority;
  if (has("due_date")) patch.due_date = checkedDate(fields.due_date, "due_date");
  if (has("starred")) patch.is_starred = fields.starred === true;
  if (has("category")) patch.category_id = fields.category == null ? null : await resolveCategoryId(admin, userId, fields.category);
  if (has("client")) patch.client_id = fields.client == null ? null : await resolveClientId(admin, fields.client);

  if (has("project_id") || has("phase_id")) {
    const link = await resolveTaskProjectPhase({
      supabase: admin,
      userId,
      projectId: has("project_id") ? fields.project_id : existing.project_id,
      phaseId: fields.phase_id,
      clientId: has("client") ? (patch.client_id as number | null) : undefined,
      hasProjectIdField: has("project_id"),
      hasPhaseIdField: has("phase_id"),
    });
    if ("error" in link) throw new PoobahError(link.error ?? "Could not link the task to that project.", link.status ?? 400);
    if (has("project_id")) {
      patch.project_id = link.projectId;
      if (link.projectId == null) patch.phase_id = null;
    }
    if (has("phase_id")) {
      patch.phase_id = link.phaseId;
      if (link.projectId != null) patch.project_id = link.projectId;
    }
    if (link.clientId != null && !has("client")) patch.client_id = link.clientId;
  }

  const { data, error } = await admin.from("user_tasks").update(patch).eq("id", taskId).eq("owner_user_id", userId).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new PoobahError(`No task ${taskId} on your list.`, 404);
  const task = data as UserTask;
  await syncProjects(admin, userId, existing.project_id, task.project_id);
  return { before: existing, task };
}

export function registerTaskTools(server: McpServer) {
  const admin = () => createAdminClient();

  server.registerTool(
    "list_my_tasks",
    {
      title: "List my tasks",
      description:
        "Your tasks from My Tasks in BIP Control. Defaults to every open task (not done). Filters: status, client, project, due on or before a date, starred only. Sorted starred first, then by due date (overdue first, no date last), then priority. Always the complete matching list, never cut short. Each task says whether it is overdue (Eastern time).",
      inputSchema: z.object({
        status: z
          .enum(["open", "done", "all", ...USER_TASK_STATUSES] as [string, ...string[]])
          .optional()
          .describe("open (default) = everything not done; done; all; or one stage: not_started, in_progress, waiting_on_client."),
        client: clientRef.optional(),
        project_id: z.number().int().positive().optional(),
        due_by: dateText.optional().describe("Only tasks due on or before this date (YYYY-MM-DD). Use today's date for 'due today or overdue'."),
        starred_only: z.boolean().optional(),
      }),
      annotations: readOnly,
    },
    async ({ status, client, project_id, due_by, starred_only }, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const clientId = client != null ? await resolveClientId(db, client) : null;
        const all = await fetchAllRows<UserTask>(
          (from, to) =>
            db.from("user_tasks").select("*").eq("owner_user_id", userId).order("updated_at", { ascending: false }).order("id", { ascending: false }).range(from, to),
          "tasks",
        );
        const matching = sortTasks(
          filterTasks(all, {
            status: (status ?? "open") as Parameters<typeof filterTasks>[1]["status"],
            clientId,
            projectId: project_id ?? null,
            dueBy: checkedDate(due_by, "due_by"),
            starredOnly: starred_only,
          }),
        );
        const tasks = await describeTasks(db, userId, matching);
        return {
          today: todayEastern(),
          count: tasks.length,
          complete: true,
          note: `${tasks.length} matching task(s) of ${all.length} on your list, all shown.`,
          overdue_count: tasks.filter((task) => task.overdue).length,
          tasks,
        };
      }),
  );

  server.registerTool(
    "add_task",
    {
      title: "Add a task",
      description:
        "Add a task to My Tasks in BIP Control. Only title is required. Link it to a client (name or id) and/or a project (project_id from list_projects; a project's client is applied automatically). Category is one of your task category names.",
      inputSchema: z.object({
        title: z.string().min(1),
        notes: z.string().optional(),
        description: z.string().optional(),
        status: statusEnum.optional().describe("Default not_started."),
        priority: priorityEnum.optional().describe("Default medium."),
        due_date: dateText.optional(),
        starred: z.boolean().optional(),
        category: z.string().optional(),
        client: clientRef.optional(),
        project_id: z.number().int().positive().optional(),
        phase_id: z.number().int().positive().optional().describe("A phase of the project (from get_project)."),
      }),
      annotations: write,
    },
    async (args, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const title = normalizeTaskTitle(args.title);
        if (!title) throw new PoobahError("Task title is required.", 400);
        const clientId = args.client != null ? await resolveClientId(db, args.client) : null;
        const categoryId = args.category != null ? await resolveCategoryId(db, userId, args.category) : null;
        const link = await resolveTaskProjectPhase({
          supabase: db,
          userId,
          projectId: args.project_id,
          phaseId: args.phase_id,
          clientId,
          hasProjectIdField: args.project_id != null,
          hasPhaseIdField: args.phase_id != null,
        });
        if ("error" in link) throw new PoobahError(link.error ?? "Could not link the task to that project.", link.status ?? 400);
        const nowIso = new Date().toISOString();
        const { data, error } = await db
          .from("user_tasks")
          .insert({
            owner_user_id: userId,
            title,
            notes: normalizeTaskNotes(args.notes),
            description: normalizeTaskNotes(args.description),
            status: args.status ?? "not_started",
            priority: args.priority ?? "medium",
            due_date: checkedDate(args.due_date, "due_date"),
            category_id: categoryId,
            client_id: link.clientId,
            project_id: link.projectId,
            phase_id: link.phaseId,
            is_starred: args.starred === true,
            source_type: "manual",
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("*")
          .single();
        if (error || !data) throw error ?? new Error("Failed to create task");
        await syncProjects(db, userId, link.projectId);
        const [task] = await describeTasks(db, userId, [data as UserTask]);
        return { saved: true, task };
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Change a task",
      description:
        "Change a task's title, notes, description, status, priority, due date, star, category, client, project or phase. Only the fields given change; unknown fields are refused. Set due_date, category, client, project_id or phase_id to null to clear it.",
      inputSchema: z.object({
        task_id: z.number().int().positive(),
        fields: z
          .object({
            title: z.string().min(1).optional(),
            notes: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            status: statusEnum.optional(),
            priority: priorityEnum.optional(),
            due_date: dateText.nullable().optional(),
            starred: z.boolean().optional(),
            category: z.string().nullable().optional(),
            client: clientRef.nullable().optional(),
            project_id: z.number().int().positive().nullable().optional(),
            phase_id: z.number().int().positive().nullable().optional(),
          })
          .strict(),
      }),
      annotations: write,
    },
    async ({ task_id, fields }, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const { task } = await updateTask(db, userId, task_id, fields);
        const [described] = await describeTasks(db, userId, [task]);
        return { saved: true, task: described };
      }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description: "Mark a task done. It stays in My Tasks under Done; it is not deleted.",
      inputSchema: z.object({ task_id: z.number().int().positive() }),
      annotations: write,
    },
    async ({ task_id }, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const { task } = await updateTask(db, userId, task_id, { status: "done" });
        const [described] = await describeTasks(db, userId, [task]);
        return { saved: true, task: described };
      }),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List my projects",
      description:
        "Your projects in BIP Control, most recently updated first, with client, status, target dates, phase progress and open task count. Defaults to active projects; pass status \"all\" or a specific status (draft, active, paused, completed, archived). Always the complete list.",
      inputSchema: z.object({
        status: z.union([projectStatusEnum, z.literal("all")]).optional(),
        client: clientRef.optional(),
      }),
      annotations: readOnly,
    },
    async ({ status, client }, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const clientId = client != null ? await resolveClientId(db, client) : null;
        const wanted = status ?? "active";
        const projects = await fetchAllRows<ClientProject>((from, to) => {
          let query = db.from("client_projects").select("*").eq("owner_user_id", userId);
          if (wanted !== "all") query = query.eq("status", wanted);
          if (clientId != null) query = query.eq("client_id", clientId);
          return query.order("updated_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
        }, "projects");
        const [{ phasesByProject, openTaskCountByProject }, clients] = await Promise.all([
          batchProjectMeta(db, userId, projects.map((project) => project.id)),
          clientNames(db, projects.map((project) => project.client_id)),
        ]);
        return {
          count: projects.length,
          complete: true,
          filter: { status: wanted, client_id: clientId },
          projects: projects.map((project) => {
            const phases = phasesByProject.get(project.id) ?? [];
            return {
              project_id: project.id,
              name: project.name,
              status: project.status,
              client: project.client_id != null ? { id: project.client_id, name: clients.get(project.client_id) ?? null } : null,
              objective: project.objective,
              target_start_date: project.target_start_date,
              target_end_date: project.target_end_date,
              phases_done: phases.filter((phase) => phase.status === "done").length,
              phases_total: phases.length,
              open_tasks: openTaskCountByProject.get(project.id) ?? 0,
              updated_at: project.updated_at,
            };
          }),
        };
      }),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get a project",
      description: "Everything about one project: details, client, each phase with its tasks, tasks not in a phase, and saved links. Nothing is left out.",
      inputSchema: z.object({ project_id: z.number().int().positive() }),
      annotations: readOnly,
    },
    async ({ project_id }, ctx) =>
      run(ctx as Ctx, async (userId) => {
        const db = admin();
        const project = await getOwnedProject(db, userId, project_id);
        if (!project) throw new PoobahError(`No project ${project_id} of yours.`, 404);
        const [grouped, links, categories] = await Promise.all([
          listProjectTasksGrouped(db, userId, project_id),
          listProjectLinks(db, userId, project_id),
          listTaskCategories(db, userId),
        ]);
        const clients = await clientNames(db, [project.client_id]);
        const phases = await Promise.all(
          grouped.phases.map(async (entry) => ({
            phase_id: entry.phase.id,
            title: entry.phase.title,
            status: entry.phase.status,
            done: entry.doneCount,
            total: entry.totalCount,
            tasks: await describeTasks(db, userId, sortTasks(entry.tasks), categories),
          })),
        );
        return {
          complete: true,
          project: { ...project, client: project.client_id != null ? { id: project.client_id, name: clients.get(project.client_id) ?? null } : null },
          phases,
          tasks_without_phase: await describeTasks(db, userId, sortTasks(grouped.unassigned), categories),
          links: links.map((link) => ({ label: link.label, url: link.url })),
        };
      }),
  );
}
