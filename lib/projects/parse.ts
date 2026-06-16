import type { ClientProjectPlanJson } from "@/lib/types/client";

export function jsonBlockToObject<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export function parseProjectPlanJson(text: string): ClientProjectPlanJson | null {
  const parsed = jsonBlockToObject<Partial<ClientProjectPlanJson>>(text);
  if (!parsed || !Array.isArray(parsed.phases)) return null;
  const phases = parsed.phases
    .map((phase) => {
      if (!phase || typeof phase.title !== "string") return null;
      const title = phase.title.trim();
      if (!title) return null;
      const tasks = Array.isArray(phase.tasks)
        ? phase.tasks
            .map((task) => {
              if (!task || typeof task.title !== "string") return null;
              const taskTitle = task.title.trim();
              if (!taskTitle) return null;
              return {
                title: taskTitle,
                priority:
                  task.priority === "low" ||
                  task.priority === "medium" ||
                  task.priority === "high"
                    ? task.priority
                    : undefined,
                dueDate:
                  typeof task.dueDate === "string" ? task.dueDate : undefined,
                notes:
                  typeof task.notes === "string" ? task.notes.trim() : undefined,
              };
            })
            .filter((task): task is NonNullable<typeof task> => task != null)
        : [];
      return { title, tasks };
    })
    .filter((phase): phase is NonNullable<typeof phase> => phase != null);
  if (!phases.length) return null;
  return {
    phases,
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
    risks: Array.isArray(parsed.risks)
      ? parsed.risks
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
  };
}
