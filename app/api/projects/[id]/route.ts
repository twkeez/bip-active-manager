import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countOpenProjectTasks,
  fetchProjectClient,
  getOwnedProjectOrThrow,
  listProjectArtifacts,
  listProjectPhases,
} from "@/lib/projects/access";
import {
  isClientProjectStatus,
  normalizeProjectDate,
  normalizeProjectName,
  normalizeProjectText,
} from "@/lib/projects/shared";
import type { ClientProject, ClientProjectWithMeta } from "@/lib/types/client";

type UpdateProjectBody = {
  name?: string;
  description?: string | null;
  objective?: string | null;
  status?: ClientProject["status"];
  clientId?: number | null;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owned = await getOwnedProjectOrThrow(supabase, user.id, params.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const [phases, artifacts, openTaskCount] = await Promise.all([
    listProjectPhases(supabase, user.id, owned.projectId),
    listProjectArtifacts(supabase, user.id, owned.projectId),
    countOpenProjectTasks(supabase, user.id, owned.projectId),
  ]);

  const project: ClientProjectWithMeta = {
    ...owned.project,
    client: await fetchProjectClient(supabase, owned.project.client_id),
    phases,
    phaseDoneCount: phases.filter((phase) => phase.status === "done").length,
    phaseTotalCount: phases.length,
    openTaskCount,
  };

  return NextResponse.json({ project, artifacts });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owned = await getOwnedProjectOrThrow(supabase, user.id, params.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  let body: UpdateProjectBody;
  try {
    body = (await request.json()) as UpdateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = normalizeProjectName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
    }
    patch.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    patch.description = normalizeProjectText(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, "objective")) {
    patch.objective = normalizeProjectText(body.objective);
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!isClientProjectStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, "clientId")) {
    if (body.clientId == null) {
      patch.client_id = null;
    } else {
      const clientId = Number(body.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .maybeSingle();
      if (!clientRow) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      patch.client_id = clientId;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "targetStartDate")) {
    const targetStartDate = normalizeProjectDate(body.targetStartDate);
    if (body.targetStartDate != null && !targetStartDate) {
      return NextResponse.json({ error: "Invalid targetStartDate" }, { status: 400 });
    }
    patch.target_start_date = targetStartDate;
  }
  if (Object.prototype.hasOwnProperty.call(body, "targetEndDate")) {
    const targetEndDate = normalizeProjectDate(body.targetEndDate);
    if (body.targetEndDate != null && !targetEndDate) {
      return NextResponse.json({ error: "Invalid targetEndDate" }, { status: 400 });
    }
    patch.target_end_date = targetEndDate;
  }

  const { data: updated, error } = await supabase
    .from("client_projects")
    .update(patch)
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id)
    .select("*")
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update project" },
      { status: 500 },
    );
  }

  const project = updated as ClientProject;
  const phases = await listProjectPhases(supabase, user.id, owned.projectId);
  const openTaskCount = await countOpenProjectTasks(
    supabase,
    user.id,
    owned.projectId,
  );
  const client = await fetchProjectClient(supabase, project.client_id);

  const enriched: ClientProjectWithMeta = {
    ...project,
    client: await fetchProjectClient(supabase, project.client_id),
    phases,
    phaseDoneCount: phases.filter((phase) => phase.status === "done").length,
    phaseTotalCount: phases.length,
    openTaskCount,
  };
  return NextResponse.json({ project: enriched });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owned = await getOwnedProjectOrThrow(supabase, user.id, params.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const { error } = await supabase
    .from("client_projects")
    .delete()
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
