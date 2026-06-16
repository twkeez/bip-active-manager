import type { ClientProject, ProjectHealthSummary, UserTask } from "@/lib/types/client";

export function computeProjectHealth(
  project: Pick<ClientProject, "target_end_date">,
  tasks: Pick<UserTask, "status" | "due_date">[],
  todayDate = new Date().toISOString().slice(0, 10),
): ProjectHealthSummary {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTaskCount = openTasks.filter(
    (task) => task.due_date != null && task.due_date < todayDate,
  ).length;

  const upcomingDueDates = openTasks
    .map((task) => task.due_date)
    .filter((value): value is string => Boolean(value))
    .sort();

  let daysToTargetEnd: number | null = null;
  if (project.target_end_date) {
    const end = new Date(`${project.target_end_date}T00:00:00`);
    const today = new Date(`${todayDate}T00:00:00`);
    daysToTargetEnd = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const totalCount = tasks.length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const taskCompletionPercent =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return {
    openTaskCount: openTasks.length,
    overdueTaskCount,
    nextDueDate: upcomingDueDates[0] ?? null,
    daysToTargetEnd,
    taskCompletionPercent,
  };
}
