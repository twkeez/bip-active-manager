import type { UserTask } from "@/lib/types/client";

// Pure helpers for the connector's task tools (lib/tasks/mcp-tools.ts), kept
// apart so they can be tested without a database.

export type TaskStatusFilter = "open" | "done" | "all" | UserTask["status"];

export type TaskFilter = {
  status?: TaskStatusFilter;
  clientId?: number | null;
  projectId?: number | null;
  dueBy?: string | null;
  starredOnly?: boolean;
};

export function filterTasks<T extends UserTask>(tasks: T[], filter: TaskFilter): T[] {
  const status = filter.status ?? "open";
  return tasks.filter((task) => {
    if (status === "open" && task.status === "done") return false;
    if (status === "done" && task.status !== "done") return false;
    if (status !== "open" && status !== "done" && status !== "all" && task.status !== status) return false;
    if (filter.clientId != null && task.client_id !== filter.clientId) return false;
    if (filter.projectId != null && task.project_id !== filter.projectId) return false;
    if (filter.dueBy && (!task.due_date || task.due_date > filter.dueBy)) return false;
    if (filter.starredOnly && !task.is_starred) return false;
    return true;
  });
}

const PRIORITY_RANK: Record<UserTask["priority"], number> = { high: 0, medium: 1, low: 2 };

/** Starred first, then overdue/soonest due date (no date last), then priority, then newest. */
export function sortTasks<T extends UserTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority) return byPriority;
    return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : b.id - a.id;
  });
}

export function isOverdue(task: Pick<UserTask, "due_date" | "status">, today: string): boolean {
  return task.status !== "done" && task.due_date != null && task.due_date < today;
}
