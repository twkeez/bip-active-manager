import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnedProjectOrThrow,
  listProjectPhases,
} from "@/lib/projects/access";
import {
  isClientProjectPhaseStatus,
  normalizeProjectName,
  normalizeProjectText,
} from "@/lib/projects/shared";
import type { ClientProjectPhase } from "@/lib/types/client";

type CreatePhaseBody = {
  title?: string;
  notes?: string | null;
  status?: ClientProjectPhase["status"];
  sortOrder?: number;
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

  const phases = await listProjectPhases(supabase, user.id, owned.projectId);
  return NextResponse.json({ phases });
}

export async function POST(
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

  let body: CreatePhaseBody;
  try {
    body = (await request.json()) as CreatePhaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = normalizeProjectName(body.title);
  if (!title) {
    return NextResponse.json({ error: "Phase title is required" }, { status: 400 });
  }

  const status = body.status ?? "not_started";
  if (!isClientProjectPhaseStatus(status)) {
    return NextResponse.json({ error: "Invalid phase status" }, { status: 400 });
  }

  const existing = await listProjectPhases(supabase, user.id, owned.projectId);
  const sortOrder =
    Number.isInteger(body.sortOrder) && body.sortOrder! >= 0
      ? body.sortOrder!
      : existing.length;

  const nowIso = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("client_project_phases")
    .insert({
      project_id: owned.projectId,
      owner_user_id: user.id,
      title,
      notes: normalizeProjectText(body.notes),
      status,
      sort_order: sortOrder,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create phase" },
      { status: 500 },
    );
  }

  await supabase
    .from("client_projects")
    .update({ updated_at: nowIso })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ phase: inserted as ClientProjectPhase });
}
