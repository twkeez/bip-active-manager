import type { UserTaskStatus } from "@/lib/types/client";

export type TaskBoardStage = Exclude<UserTaskStatus, "done">;

export const TASK_BOARD_STAGES: Array<{
  id: TaskBoardStage;
  label: string;
  hint: string;
  headerClass: string;
  dropClass: string;
}> = [
  {
    id: "not_started",
    label: "Not Started",
    hint: "Queued work you have not picked up yet",
    headerClass: "border-zinc-200 bg-[#f2ede5] text-zinc-700",
    dropClass: "border-zinc-200 bg-white/70",
  },
  {
    id: "in_progress",
    label: "In Progress",
    hint: "Actively working on this",
    headerClass: "border-sky-200 bg-sky-50 text-sky-900",
    dropClass: "border-sky-100 bg-sky-50/40",
  },
  {
    id: "waiting_on_client",
    label: "Waiting on Client",
    hint: "Blocked until the client responds",
    headerClass: "border-amber-200 bg-amber-50 text-amber-900",
    dropClass: "border-amber-100 bg-amber-50/40",
  },
];

const STAGE_LABELS: Record<UserTaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting_on_client: "Waiting on Client",
  done: "Done",
};

export function taskStageLabel(status: UserTaskStatus) {
  return STAGE_LABELS[status] ?? status;
}

export function isBoardStage(value: string): value is TaskBoardStage {
  return TASK_BOARD_STAGES.some((stage) => stage.id === value);
}

export function normalizeIncomingTaskStatus(value: unknown): UserTaskStatus | null {
  if (typeof value !== "string") return null;
  if (value === "inbox") return "not_started";
  if (
    value === "not_started" ||
    value === "in_progress" ||
    value === "waiting_on_client" ||
    value === "done"
  ) {
    return value;
  }
  return null;
}
