"use client";
import type { ClientProjectPhase } from "@/lib/types/client";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
import ProjectTaskRow from "@/components/projects/project-task-row";
type PhaseGroup = { phase: ClientProjectPhase; tasks: UserTaskWithSource[] };
type Props = {
  phases: PhaseGroup[];
  unassigned: UserTaskWithSource[];
  onMoveTask: (taskId: number, phaseId: number | null) => void;
  onToggleDone: (task: UserTaskWithSource) => void;
  onToggleStar: (task: UserTaskWithSource) => void;
  onDueDateChange: (task: UserTaskWithSource, dueDate: string | null) => void;
  onOpenDetail: (task: UserTaskWithSource) => void;
};
function BoardColumn({
  title,
  phaseId,
  tasks,
  onMoveTask,
  onToggleDone,
  onToggleStar,
  onDueDateChange,
  onOpenDetail,
}: {
  title: string;
  phaseId: number | null;
  tasks: UserTaskWithSource[];
  onMoveTask: Props["onMoveTask"];
  onToggleDone: Props["onToggleDone"];
  onToggleStar: Props["onToggleStar"];
  onDueDateChange: Props["onDueDateChange"];
  onOpenDetail: Props["onOpenDetail"];
}) {
  return (
    <div
      className="flex min-w-[14rem] flex-1 flex-col rounded-lg border border-white/10 bg-bip-page/50"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = Number(event.dataTransfer.getData("taskId"));
        if (Number.isInteger(taskId) && taskId > 0) {
          onMoveTask(taskId, phaseId);
        }
      }}
    >
      
      <div className="border-b border-white/10 px-3 py-2">
        
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-[11px] text-white/50">{tasks.length} tasks</p>
      </div>
      <ul className="min-h-[8rem] space-y-1.5 p-2">
        
        {tasks.map((task) => (
          <li
            key={task.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("taskId", String(task.id));
            }}
          >
            
            <ProjectTaskRow
              task={task}
              onToggleDone={onToggleDone}
              onToggleStar={onToggleStar}
              onDueDateChange={onDueDateChange}
              onOpenDetail={onOpenDetail}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
export default function ProjectBoard({
  phases,
  unassigned,
  onMoveTask,
  onToggleDone,
  onToggleStar,
  onDueDateChange,
  onOpenDetail,
}: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      
      {phases.map((group) => (
        <BoardColumn
          key={group.phase.id}
          title={group.phase.title}
          phaseId={group.phase.id}
          tasks={group.tasks}
          onMoveTask={onMoveTask}
          onToggleDone={onToggleDone}
          onToggleStar={onToggleStar}
          onDueDateChange={onDueDateChange}
          onOpenDetail={onOpenDetail}
        />
      ))}
      <BoardColumn
        title="Unassigned"
        phaseId={null}
        tasks={unassigned}
        onMoveTask={onMoveTask}
        onToggleDone={onToggleDone}
        onToggleStar={onToggleStar}
        onDueDateChange={onDueDateChange}
        onOpenDetail={onOpenDetail}
      />
    </div>
  );
}
