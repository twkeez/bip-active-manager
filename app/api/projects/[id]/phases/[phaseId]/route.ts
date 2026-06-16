import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import {
  isClientProjectPhaseStatus,
  normalizeProjectName,
  normalizeProjectText,
} from "@/lib/projects/shared";

function parsePhaseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

type UpdatePhaseBody = {
  title?: string;
  notes?: string | null;
  status?: "not_started" | "in_progress" | "done";
  sortOrder?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; phaseId: string }> },
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

  const phaseId = parsePhaseId(params.phaseId);
  if (!phaseId) {
    return NextResponse.json({ error: "Invalid phase id" }, { status: 400 });
  }

  let body: UpdatePhaseBody;
  try {
    body = (await request.json()) as UpdatePhaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = normalizeProjectName(body.title);
    if (!title) {
      return NextResponse.json({ error: "Phase title cannot be empty" }, { status: 400 });
    }
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    patch.notes = normalizeProjectText(body.notes);
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!isClientProjectPhaseStatus(body.status)) {
      return NextResponse.json({ error: "Invalid phase status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder! < 0) {
      return NextResponse.json({ error: "Invalid sortOrder" }, { status: 400 });
    }
    patch.sort_order = body.sortOrder;
  }

  const { data: updated, error } = await supabase
    .from("client_project_phases")
    .update(patch)
    .eq("id", phaseId)
    .eq("project_id", owned.projectId)
    .eq("owner_user_id", user.id)
    .select("*")
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update phase" },
      { status: 404 },
    );
  }

  await supabase
    .from("client_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ phase: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; phaseId: string }> },
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

  const phaseId = parsePhaseId(params.phaseId);
  if (!phaseId) {
    return NextResponse.json({ error: "Invalid phase id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("client_project_phases")
    .delete()
    .eq("id", phaseId)
    .eq("project_id", owned.projectId)
    .eq("owner_user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("client_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ ok: true });
}
