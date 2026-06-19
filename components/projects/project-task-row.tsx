"use client";
import { Check, Star } from "lucide-react";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
type Props = {
  task: UserTaskWithSource;
  onToggleDone: (task: UserTaskWithSource) => void;
  onToggleStar: (task: UserTaskWithSource) => void;
  onDueDateChange: (task: UserTaskWithSource, dueDate: string | null) => void;
  onOpenDetail: (task: UserTaskWithSource) => void;
};
export default function ProjectTaskRow({
  task,
  onToggleDone,
  onToggleStar,
  onDueDateChange,
  onOpenDetail,
}: Props) {
  const done = task.status === "done";
  return (
    <li className="flex items-center gap-2 rounded-md border border-bip-border bg-bip-page/50 px-2 py-1.5">
      
      <button
        type="button"
        onClick={() => onToggleDone(task)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-bip-border text-transparent hover:border-bip-border"}`}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpenDetail(task)}
        className={`min-w-0 flex-1 truncate text-left text-sm ${done ? "text-bip-muted line-through" : "text-bip-text"}`}
      >
        
        {task.title}
      </button>
      <input
        type="date"
        value={task.due_date ?? ""}
        onChange={(event) =>
          onDueDateChange(task, event.target.value.trim() || null)
        }
        className="w-[7.5rem] shrink-0 rounded border border-bip-border bg-bip-card px-1 py-0.5 text-[11px] text-bip-text"
        aria-label="Due date"
      />
      <button
        type="button"
        onClick={() => onToggleStar(task)}
        className={`shrink-0 ${task.is_starred ? "text-amber-300" : "text-bip-text hover:text-bip-muted"}`}
        aria-label={task.is_starred ? "Unstar task" : "Star task"}
      >
        
        <Star
          className={`h-3.5 w-3.5 ${task.is_starred ? "fill-current" : ""}`}
        />
      </button>
    </li>
  );
}
