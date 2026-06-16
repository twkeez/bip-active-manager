import type { SupabaseClient } from "@supabase/supabase-js";
import { validateOwnedPhase } from "@/lib/projects/access";

export async function resolveTaskProjectPhase(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId?: number | null | undefined;
  phaseId?: number | null | undefined;
  clientId?: number | null | undefined;
  hasProjectIdField: boolean;
  hasPhaseIdField: boolean;
}) {
  const {
    supabase,
    userId,
    projectId: projectIdInput,
    phaseId: phaseIdInput,
    clientId,
    hasProjectIdField,
    hasPhaseIdField,
  } = params;

  let projectId =
    projectIdInput == null
      ? null
      : Number.isInteger(projectIdInput) && projectIdInput > 0
        ? projectIdInput
        : null;
  if (hasProjectIdField && projectIdInput != null && projectId == null) {
    return { error: "Invalid project id" as const, status: 400 as const };
  }

  let phaseId =
    phaseIdInput == null
      ? null
      : Number.isInteger(phaseIdInput) && phaseIdInput > 0
        ? phaseIdInput
        : null;
  if (hasPhaseIdField && phaseIdInput != null && phaseId == null) {
    return { error: "Invalid phase id" as const, status: 400 as const };
  }

  let resolvedClientId = clientId ?? null;

  if (phaseId != null) {
    const phaseRow = await validateOwnedPhase(supabase, userId, phaseId, projectId ?? undefined);
    if (!phaseRow) {
      return { error: "Phase not found" as const, status: 404 as const };
    }
    projectId = phaseRow.project_id;
  }

  if (projectId != null) {
    const { data: projectRow } = await supabase
      .from("client_projects")
      .select("id,client_id")
      .eq("id", projectId)
      .eq("owner_user_id", userId)
      .maybeSingle<{ id: number; client_id: number }>();
    if (!projectRow) {
      return { error: "Project not found" as const, status: 404 as const };
    }
    if (clientId != null && clientId !== projectRow.client_id) {
      return {
        error: "clientId does not match project client" as const,
        status: 400 as const,
      };
    }
    resolvedClientId = projectRow.client_id;
  }

  if (hasProjectIdField && projectIdInput === null) {
    phaseId = null;
  }

  return { projectId, phaseId, clientId: resolvedClientId };
}
