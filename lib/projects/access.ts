import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientProject,
  ClientProjectArtifact,
  ClientProjectPhase,
  TaskClientOption,
} from "@/lib/types/client";
import { parseProjectId } from "@/lib/projects/shared";

export async function getOwnedProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data, error } = await supabase
    .from("client_projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientProject | null) ?? null;
}

export async function getOwnedProjectOrThrow(
  supabase: SupabaseClient,
  userId: string,
  projectIdParam: string,
) {
  const projectId = parseProjectId(projectIdParam);
  if (!projectId) {
    return { error: "Invalid project id" as const, status: 400 as const };
  }
  const project = await getOwnedProject(supabase, userId, projectId);
  if (!project) {
    return { error: "Project not found" as const, status: 404 as const };
  }
  return { project, projectId };
}

export async function fetchProjectClient(
  supabase: SupabaseClient,
  clientId: number | null,
): Promise<TaskClientOption | null> {
  if (clientId == null) return null;
  const { data } = await supabase
    .from("clients")
    .select("id,account_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  return data as TaskClientOption;
}

export async function listProjectPhases(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data, error } = await supabase
    .from("client_project_phases")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClientProjectPhase[];
}

export async function listProjectArtifacts(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
  limit = 50,
) {
  const { data, error } = await supabase
    .from("client_project_artifacts")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ClientProjectArtifact[];
}

export async function countOpenProjectTasks(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { count, error } = await supabase
    .from("user_tasks")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .neq("status", "done");
  if (error) throw error;
  return count ?? 0;
}

export async function batchProjectMeta(
  supabase: SupabaseClient,
  userId: string,
  projectIds: number[],
) {
  if (!projectIds.length) {
    return {
      phasesByProject: new Map<number, ClientProjectPhase[]>(),
      openTaskCountByProject: new Map<number, number>(),
    };
  }

  const { data: phasesRaw, error: phasesError } = await supabase
    .from("client_project_phases")
    .select("*")
    .eq("owner_user_id", userId)
    .in("project_id", projectIds)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (phasesError) throw phasesError;

  const { data: tasksRaw, error: tasksError } = await supabase
    .from("user_tasks")
    .select("project_id,status")
    .eq("owner_user_id", userId)
    .in("project_id", projectIds);
  if (tasksError) throw tasksError;

  const phasesByProject = new Map<number, ClientProjectPhase[]>();
  for (const row of phasesRaw ?? []) {
    const phase = row as ClientProjectPhase;
    const bucket = phasesByProject.get(phase.project_id) ?? [];
    bucket.push(phase);
    phasesByProject.set(phase.project_id, bucket);
  }

  const openTaskCountByProject = new Map<number, number>();
  for (const row of tasksRaw ?? []) {
    const task = row as { project_id: number; status: string };
    if (task.status === "done") continue;
    openTaskCountByProject.set(
      task.project_id,
      (openTaskCountByProject.get(task.project_id) ?? 0) + 1,
    );
  }

  return { phasesByProject, openTaskCountByProject };
}

export async function listProjectTasksGrouped(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const phases = await listProjectPhases(supabase, userId, projectId);
  const { data: tasksRaw, error } = await supabase
    .from("user_tasks")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const tasks = (tasksRaw ?? []) as import("@/lib/types/client").UserTask[];
  const tasksByPhase = new Map<number, typeof tasks>();
  const unassigned: typeof tasks = [];

  for (const task of tasks) {
    if (task.phase_id == null) {
      unassigned.push(task);
      continue;
    }
    const bucket = tasksByPhase.get(task.phase_id) ?? [];
    bucket.push(task);
    tasksByPhase.set(task.phase_id, bucket);
  }

  return {
    phases: phases.map((phase) => {
      const phaseTasks = tasksByPhase.get(phase.id) ?? [];
      const doneCount = phaseTasks.filter((task) => task.status === "done").length;
      return {
        phase,
        tasks: phaseTasks,
        doneCount,
        totalCount: phaseTasks.length,
      };
    }),
    unassigned,
  };
}

export async function listProjectLinks(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data, error } = await supabase
    .from("client_project_links")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as import("@/lib/types/client").ClientProjectLink[];
}

export async function listProjectAttachments(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
) {
  const { data, error } = await supabase
    .from("client_project_attachments")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as import("@/lib/types/client").ClientProjectAttachment[];
}

export async function validateOwnedPhase(
  supabase: SupabaseClient,
  userId: string,
  phaseId: number,
  projectId?: number,
) {
  const { data, error } = await supabase
    .from("client_project_phases")
    .select("id,project_id")
    .eq("id", phaseId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { id: number; project_id: number };
  if (projectId != null && row.project_id !== projectId) return null;
  return row;
}
