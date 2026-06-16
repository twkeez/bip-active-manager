import type {
  TaskClientOption,
  UserTaskAttachment,
  UserTaskLink,
  UserTaskPerson,
  UserTask,
  UserTaskCategory,
  UserTaskPriority,
  UserTaskSource,
  UserTaskStatus,
} from "@/lib/types/client";
import { normalizeIncomingTaskStatus } from "@/lib/tasks/stages";

export type UserTaskWithSource = UserTask & {
  source: UserTaskSource | null;
  category: UserTaskCategory | null;
  client: TaskClientOption | null;
  assignees: UserTaskPerson[];
  links: UserTaskLink[];
  attachments: UserTaskAttachment[];
};

export const USER_TASK_STATUSES: UserTaskStatus[] = [
  "not_started",
  "in_progress",
  "waiting_on_client",
  "done",
];
export const USER_TASK_PRIORITIES: UserTaskPriority[] = [
  "low",
  "medium",
  "high",
];
export const DEFAULT_TASK_CATEGORY_NAMES = [
  "Basra",
  "Client",
  "Strategist",
  "Elyse",
  "Kelly",
  "Hannah",
];

export function isUserTaskStatus(value: unknown): value is UserTaskStatus {
  return normalizeIncomingTaskStatus(value) != null;
}

export function isUserTaskPriority(value: unknown): value is UserTaskPriority {
  return (
    typeof value === "string" &&
    USER_TASK_PRIORITIES.includes(value as UserTaskPriority)
  );
}

export function normalizeTaskTitle(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeTaskNotes(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function normalizeTaskDueDate(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

export function joinTasksWithSources(
  tasks: UserTask[],
  sources: UserTaskSource[],
  categories: UserTaskCategory[] = [],
  clients: TaskClientOption[] = [],
  assigneesByTask: Record<number, UserTaskPerson[]> = {},
  linksByTask: Record<number, UserTaskLink[]> = {},
  attachmentsByTask: Record<number, UserTaskAttachment[]> = {},
): UserTaskWithSource[] {
  const sourceByTask = new Map<number, UserTaskSource>();
  for (const source of sources) {
    if (!sourceByTask.has(source.task_id)) {
      sourceByTask.set(source.task_id, source);
    }
  }
  const categoriesById = new Map<number, UserTaskCategory>();
  for (const category of categories) {
    categoriesById.set(category.id, category);
  }
  const clientsById = new Map<number, TaskClientOption>();
  for (const client of clients) {
    clientsById.set(client.id, client);
  }
  return tasks.map((task) => ({
    ...task,
    source: sourceByTask.get(task.id) ?? null,
    category:
      task.category_id != null ? (categoriesById.get(task.category_id) ?? null) : null,
    client: task.client_id != null ? (clientsById.get(task.client_id) ?? null) : null,
    assignees: assigneesByTask[task.id] ?? [],
    links: linksByTask[task.id] ?? [],
    attachments: attachmentsByTask[task.id] ?? [],
  }));
}

export function normalizeCategoryName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}
