"use client";
import {
  CalendarClock,
  Check,
  GripVertical,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
import {
  TASK_BOARD_STAGES,
  type TaskBoardStage,
  normalizeIncomingTaskStatus,
  taskStageLabel,
} from "@/lib/tasks/stages";
import type { UserTaskStatus } from "@/lib/types/client";
type Props = {
  tasks: UserTaskWithSource[];
  onMoveTask: (taskId: number, status: TaskBoardStage) => void;
  onToggleDone: (task: UserTaskWithSource) => void;
  onToggleStar: (task: UserTaskWithSource) => void;
  onOpenDetail: (task: UserTaskWithSource) => void;
  onDeleteTask: (taskId: number) => void;
  formatDate: (value: string | null | undefined) => string;
  taskSourceLabel: (task: UserTaskWithSource) => string;
  buildExternalSourceUrl: (
    source: UserTaskWithSource["source"],
  ) => string | null;
};
function formatCategoryLabel(task: UserTaskWithSource) {
  return task.category?.name?.trim() || null;
}
function TaskStageRow({
  task,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: {
  task: UserTaskWithSource;
  onToggleDone: Props["onToggleDone"];
  onToggleStar: Props["onToggleStar"];
  onOpenDetail: Props["onOpenDetail"];
  onDeleteTask: Props["onDeleteTask"];
  formatDate: Props["formatDate"];
  taskSourceLabel: Props["taskSourceLabel"];
  buildExternalSourceUrl: Props["buildExternalSourceUrl"];
}) {
  const sourceUrl = buildExternalSourceUrl(task.source);
  const categoryLabel = formatCategoryLabel(task);
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("taskId", String(task.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      className={`flex items-start gap-2.5 border-b border-white/[0.08] bg-bip-card px-3 py-2 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.06] ${task.is_starred ? "bg-amber-500/10" : ""}`}
    >
      
      <span
        className="mt-1 cursor-grab text-white/75 active:cursor-grabbing"
        aria-hidden
      >
        
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={() => onToggleDone(task)}
        className={`mt-0.5 inline-flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${task.status === "done" ? "border-emerald-500 bg-emerald-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" : "border-white/30 bg-bip-card text-transparent hover:border-emerald-500"}`}
        aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
      >
        
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpenDetail(task)}
        className="min-w-0 flex-1 text-left"
      >
        
        <p className="truncate text-[14px] font-medium text-white/75">
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50">
          
          <span className="inline-flex items-center gap-1">
            
            <CalendarClock className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
          <span className="rounded-full border border-white/[0.12] px-2 py-0.5">
            
            {task.priority.toUpperCase()}
          </span>
          {categoryLabel && (
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-violet-300">
              
              {categoryLabel}
            </span>
          )}
          {task.client && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] px-2 py-0.5">
              
              <UserRound className="h-2.5 w-2.5" />
              {task.client.account_name}
            </span>
          )}
          <span className="rounded-full border border-white/[0.12] px-2 py-0.5">
            
            {taskSourceLabel(task)}
          </span>
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-white/50 underline"
            onClick={(event) => event.stopPropagation()}
          >
            
            Open source
          </a>
        )}
      </button>
      <button
        type="button"
        onClick={() => onToggleStar(task)}
        className={`mt-0.5 rounded p-1 transition-colors ${task.is_starred ? "text-[#ff6a2f]" : "text-white/75 hover:text-orange-400"}`}
        aria-label="Toggle star"
      >
        
        <Star
          className={`h-3.5 w-3.5 ${task.is_starred ? "fill-current" : ""}`}
        />
      </button>
      <button
        type="button"
        onClick={() => onDeleteTask(task.id)}
        className="mt-0.5 rounded p-1 text-white/75 transition-colors hover:text-red-500"
        aria-label="Delete task"
      >
        
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
function StageSection({
  stageId,
  label,
  hint,
  headerClass,
  dropClass,
  tasks,
  onMoveTask,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: {
  stageId: TaskBoardStage;
  label: string;
  hint: string;
  headerClass: string;
  dropClass: string;
  tasks: UserTaskWithSource[];
  onMoveTask: Props["onMoveTask"];
  onToggleDone: Props["onToggleDone"];
  onToggleStar: Props["onToggleStar"];
  onOpenDetail: Props["onOpenDetail"];
  onDeleteTask: Props["onDeleteTask"];
  formatDate: Props["formatDate"];
  taskSourceLabel: Props["taskSourceLabel"];
  buildExternalSourceUrl: Props["buildExternalSourceUrl"];
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border ${dropClass}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = Number(event.dataTransfer.getData("taskId"));
        if (Number.isInteger(taskId) && taskId > 0) {
          onMoveTask(taskId, stageId);
        }
      }}
    >
      
      <div className={`border-b px-3 py-2 ${headerClass}`}>
        
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          
          <div>
            
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              
              {label}
            </h3>
            <p className="mt-0.5 text-[11px] font-normal normal-case opacity-80">
              {hint}
            </p>
          </div>
          <span className="text-[11px] font-medium opacity-70">
            {tasks.length} tasks
          </span>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="border-t border-dashed border-white/[0.12]/70 px-3 py-5 text-center text-[11px] text-white/40">
          
          Drop tasks here
        </p>
      ) : (
        <ul>
          
          {tasks.map((task) => (
            <TaskStageRow
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onToggleStar={onToggleStar}
              onOpenDetail={onOpenDetail}
              onDeleteTask={onDeleteTask}
              formatDate={formatDate}
              taskSourceLabel={taskSourceLabel}
              buildExternalSourceUrl={buildExternalSourceUrl}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
export function groupTasksByStage(tasks: UserTaskWithSource[]) {
  const grouped = new Map<TaskBoardStage, UserTaskWithSource[]>();
  for (const stage of TASK_BOARD_STAGES) {
    grouped.set(stage.id, []);
  }
  for (const task of tasks) {
    const normalized = normalizeIncomingTaskStatus(task.status);
    if (!normalized || normalized === "done") continue;
    grouped.get(normalized)!.push(task);
  }
  return grouped;
}
export function taskStageLabelSafe(status: UserTaskStatus) {
  return taskStageLabel(status);
}
export default function TaskStageBoard({
  tasks,
  onMoveTask,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: Props) {
  const grouped = groupTasksByStage(tasks);
  return (
    <div className="space-y-4">
      
      {TASK_BOARD_STAGES.map((stage) => (
        <StageSection
          key={stage.id}
          stageId={stage.id}
          label={stage.label}
          hint={stage.hint}
          headerClass={stage.headerClass}
          dropClass={stage.dropClass}
          tasks={grouped.get(stage.id) ?? []}
          onMoveTask={onMoveTask}
          onToggleDone={onToggleDone}
          onToggleStar={onToggleStar}
          onOpenDetail={onOpenDetail}
          onDeleteTask={onDeleteTask}
          formatDate={formatDate}
          taskSourceLabel={taskSourceLabel}
          buildExternalSourceUrl={buildExternalSourceUrl}
        />
      ))}
    </div>
  );
}
