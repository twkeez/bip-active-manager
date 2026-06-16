import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnedProjectOrThrow,
  listProjectArtifacts,
} from "@/lib/projects/access";
import {
  isClientProjectArtifactType,
  normalizeProjectName,
  normalizeProjectText,
} from "@/lib/projects/shared";
import type { ClientProjectArtifact } from "@/lib/types/client";

type CreateArtifactBody = {
  artifactType?: ClientProjectArtifact["artifact_type"];
  title?: string;
  contentMarkdown?: string;
  contentJson?: Record<string, unknown>;
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

  const artifacts = await listProjectArtifacts(supabase, user.id, owned.projectId);
  return NextResponse.json({ artifacts });
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

  let body: CreateArtifactBody;
  try {
    body = (await request.json()) as CreateArtifactBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const artifactType = body.artifactType ?? "note";
  if (!isClientProjectArtifactType(artifactType)) {
    return NextResponse.json({ error: "Invalid artifact type" }, { status: 400 });
  }

  const title = normalizeProjectName(body.title);
  if (!title) {
    return NextResponse.json({ error: "Artifact title is required" }, { status: 400 });
  }

  const contentMarkdown =
    normalizeProjectText(body.contentMarkdown) ?? "";

  const { data: inserted, error } = await supabase
    .from("client_project_artifacts")
    .insert({
      project_id: owned.projectId,
      owner_user_id: user.id,
      artifact_type: artifactType,
      title,
      content_markdown: contentMarkdown,
      content_json: body.contentJson ?? {},
    })
    .select("*")
    .single();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create artifact" },
      { status: 500 },
    );
  }

  await supabase
    .from("client_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ artifact: inserted as ClientProjectArtifact });
}
