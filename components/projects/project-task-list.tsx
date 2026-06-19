"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ClientProjectPhase } from "@/lib/types/client";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
import ProjectTaskRow from "@/components/projects/project-task-row";
type PhaseGroup = {
  phase: ClientProjectPhase;
  tasks: UserTaskWithSource[];
  doneCount: number;
  totalCount: number;
};
type Props = {
  phases: PhaseGroup[];
  unassigned: UserTaskWithSource[];
  onToggleDone: (task: UserTaskWithSource) => void;
  onToggleStar: (task: UserTaskWithSource) => void;
  onDueDateChange: (task: UserTaskWithSource, dueDate: string | null) => void;
  onOpenDetail: (task: UserTaskWithSource) => void;
};
function PhaseSection({
  title,
  doneCount,
  totalCount,
  tasks,
  defaultOpen = true,
  onToggleDone,
  onToggleStar,
  onDueDateChange,
  onOpenDetail,
}: {
  title: string;
  doneCount: number;
  totalCount: number;
  tasks: UserTaskWithSource[];
  defaultOpen?: boolean;
  onToggleDone: Props["onToggleDone"];
  onToggleStar: Props["onToggleStar"];
  onDueDateChange: Props["onDueDateChange"];
  onOpenDetail: Props["onOpenDetail"];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const percent =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  return (
    <section className="rounded-lg border border-bip-border bg-bip-page/40">
      
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-bip-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-bip-muted" />
        )}
        <span className="flex-1 font-medium text-bip-text">{title}</span>
        <span className="text-xs text-bip-muted">
          
          {doneCount}/{totalCount} · {percent}%
        </span>
      </button>
      {open ? (
        <ul className="space-y-1 border-t border-bip-border px-2 py-2">
          
          {tasks.length === 0 ? (
            <li className="px-1 py-1 text-xs text-bip-muted">
              No tasks in this phase.
            </li>
          ) : (
            tasks.map((task) => (
              <ProjectTaskRow
                key={task.id}
                task={task}
                onToggleDone={onToggleDone}
                onToggleStar={onToggleStar}
                onDueDateChange={onDueDateChange}
                onOpenDetail={onOpenDetail}
              />
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
export default function ProjectTaskList({
  phases,
  unassigned,
  onToggleDone,
  onToggleStar,
  onDueDateChange,
  onOpenDetail,
}: Props) {
  return (
    <div className="space-y-3">
      
      {phases.map((group) => (
        <PhaseSection
          key={group.phase.id}
          title={group.phase.title}
          doneCount={group.doneCount}
          totalCount={group.totalCount}
          tasks={group.tasks}
          onToggleDone={onToggleDone}
          onToggleStar={onToggleStar}
          onDueDateChange={onDueDateChange}
          onOpenDetail={onOpenDetail}
        />
      ))}
      <PhaseSection
        title="Unassigned"
        doneCount={unassigned.filter((task) => task.status === "done").length}
        totalCount={unassigned.length}
        tasks={unassigned}
        defaultOpen={unassigned.length > 0}
        onToggleDone={onToggleDone}
        onToggleStar={onToggleStar}
        onDueDateChange={onDueDateChange}
        onOpenDetail={onOpenDetail}
      />
    </div>
  );
}
