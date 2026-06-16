import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientProjectPhaseStatus, UserTask } from "@/lib/types/client";

export function derivePhaseStatusFromTasks(
  tasks: Pick<UserTask, "status">[],
): ClientProjectPhaseStatus {
  if (tasks.length === 0) return "not_started";
  const doneCount = tasks.filter((task) => task.status === "done").length;
  if (doneCount === 0) return "not_started";
  if (doneCount === tasks.length) return "done";
  return "in_progress";
}

export async function syncPhaseProgressFromTasks(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data: phasesRaw, error: phasesError } = await supabase
    .from("client_project_phases")
    .select("id,status")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId);
  if (phasesError) throw phasesError;

  const { data: tasksRaw, error: tasksError } = await supabase
    .from("user_tasks")
    .select("id,phase_id,status")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId);
  if (tasksError) throw tasksError;

  const tasksByPhase = new Map<number, Pick<UserTask, "status">[]>();
  for (const task of tasksRaw ?? []) {
    const phaseId = (task as { phase_id: number | null }).phase_id;
    if (phaseId == null) continue;
    const bucket = tasksByPhase.get(phaseId) ?? [];
    bucket.push({ status: (task as { status: UserTask["status"] }).status });
    tasksByPhase.set(phaseId, bucket);
  }

  const nowIso = new Date().toISOString();
  for (const phase of phasesRaw ?? []) {
    const phaseRow = phase as { id: number; status: ClientProjectPhaseStatus };
    const phaseTasks = tasksByPhase.get(phaseRow.id) ?? [];
    if (phaseTasks.length === 0) continue;
    const derived = derivePhaseStatusFromTasks(phaseTasks);
    if (derived === phaseRow.status) continue;
    const { error } = await supabase
      .from("client_project_phases")
      .update({ status: derived, updated_at: nowIso })
      .eq("id", phaseRow.id)
      .eq("owner_user_id", userId);
    if (error) throw error;
  }
}
