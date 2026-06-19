"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  GripVertical,
  Plus,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
import type { UserTaskCategory } from "@/lib/types/client";

type SharedRowProps = {
  onToggleDone: (task: UserTaskWithSource) => void;
  onToggleStar: (task: UserTaskWithSource) => void;
  onOpenDetail: (task: UserTaskWithSource) => void;
  onDeleteTask: (taskId: number) => void;
  formatDate: (value: string | null | undefined) => string;
  taskSourceLabel: (task: UserTaskWithSource) => string;
  buildExternalSourceUrl: (source: UserTaskWithSource["source"]) => string | null;
};

export type Props = SharedRowProps & {
  tasks: UserTaskWithSource[];
  categories: UserTaskCategory[];
  onMoveCategory: (taskId: number, categoryId: number | null) => void;
  onAddCategory: (name: string) => Promise<void>;
};

function TaskCategoryRow({
  task,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: SharedRowProps & { task: UserTaskWithSource }) {
  const sourceUrl = buildExternalSourceUrl(task.source);
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`flex items-start gap-2.5 border-b border-bip-border bg-bip-card px-3 py-2 transition-colors duration-150 last:border-b-0 hover:bg-bip-fill ${task.is_starred ? "bg-amber-500/10" : ""}`}
    >
      <span className="mt-1 cursor-grab text-bip-subtle active:cursor-grabbing" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={() => onToggleDone(task)}
        className={`mt-0.5 inline-flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
          task.status === "done"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-bip-border bg-bip-card text-transparent hover:border-emerald-500"
        }`}
        aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onOpenDetail(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`truncate text-[14px] font-medium text-bip-text ${
            task.status === "done" ? "text-bip-muted line-through decoration-bip-muted" : ""
          }`}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-bip-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
          <span className="rounded-full border border-bip-border px-2 py-0.5">
            {task.priority.toUpperCase()}
          </span>
          {task.client && (
            <span className="inline-flex items-center gap-1 rounded-full border border-bip-border px-2 py-0.5">
              <UserRound className="h-2.5 w-2.5" />
              {task.client.account_name}
            </span>
          )}
          <span className="rounded-full border border-bip-border px-2 py-0.5">
            {taskSourceLabel(task)}
          </span>
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-bip-muted underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open source
          </a>
        )}
      </button>
      <button
        type="button"
        onClick={() => onToggleStar(task)}
        className={`mt-0.5 rounded p-1 transition-colors ${task.is_starred ? "text-[#ff6a2f]" : "text-bip-text hover:text-orange-400"}`}
        aria-label="Toggle star"
      >
        <Star className={`h-3.5 w-3.5 ${task.is_starred ? "fill-current" : ""}`} />
      </button>
      <button
        type="button"
        onClick={() => onDeleteTask(task.id)}
        className="mt-0.5 rounded p-1 text-bip-text transition-colors hover:text-red-500"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function CategorySection({
  categoryId,
  label,
  tasks,
  onMoveCategory,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: SharedRowProps & {
  categoryId: number | null;
  label: string;
  tasks: UserTaskWithSource[];
  onMoveCategory: Props["onMoveCategory"];
}) {
  const [dragOver, setDragOver] = useState(false);
  const isUncategorized = categoryId === null;

  return (
    <section
      className={`overflow-hidden rounded-lg border transition-colors ${
        dragOver
          ? "border-violet-500/50 bg-violet-500/[0.04]"
          : isUncategorized
          ? "border-bip-border"
          : "border-bip-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = Number(e.dataTransfer.getData("taskId"));
        if (Number.isInteger(taskId) && taskId > 0) {
          onMoveCategory(taskId, categoryId);
        }
      }}
    >
      <div
        className={`border-b px-3 py-2 ${
          isUncategorized ? "bg-bip-hover" : "bg-violet-500/[0.05]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3
            className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
              isUncategorized ? "text-bip-muted" : "text-violet-300/90"
            }`}
          >
            {label}
          </h3>
          <span className="text-[11px] text-bip-subtle">{tasks.length}</span>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="px-3 py-5 text-center text-[11px] text-bip-subtle">
          {dragOver ? "Release to drop here" : "Drop tasks here"}
        </p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskCategoryRow
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

export default function TaskCategoryBoard({
  tasks,
  categories,
  onMoveCategory,
  onAddCategory,
  onToggleDone,
  onToggleStar,
  onOpenDetail,
  onDeleteTask,
  formatDate,
  taskSourceLabel,
  buildExternalSourceUrl,
}: Props) {
  const [newCatName, setNewCatName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const name = newCatName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await onAddCategory(name);
      setNewCatName("");
    } finally {
      setAdding(false);
    }
  }

  const rowProps: SharedRowProps = {
    onToggleDone,
    onToggleStar,
    onOpenDetail,
    onDeleteTask,
    formatDate,
    taskSourceLabel,
    buildExternalSourceUrl,
  };

  const openTasks = tasks.filter((t) => t.status !== "done");
  const uncategorized = openTasks.filter((t) => t.category_id == null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="New group name… press Enter"
          disabled={adding}
          className="flex-1 rounded-md border border-bip-border bg-bip-card/85 px-3 py-1.5 text-[13px] text-bip-text placeholder:text-bip-subtle disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={adding || !newCatName.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-[13px] text-bip-text hover:bg-bip-fill disabled:opacity-50 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add group
        </button>
      </div>

      <CategorySection
        categoryId={null}
        label="Uncategorized"
        tasks={uncategorized}
        onMoveCategory={onMoveCategory}
        {...rowProps}
      />

      {categories.map((cat) => (
        <CategorySection
          key={cat.id}
          categoryId={cat.id}
          label={cat.name}
          tasks={openTasks.filter((t) => t.category_id === cat.id)}
          onMoveCategory={onMoveCategory}
          {...rowProps}
        />
      ))}
    </div>
  );
}
