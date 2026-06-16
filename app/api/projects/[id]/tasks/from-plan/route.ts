import { NextResponse } from "next/server";
import { applyProjectPlan, previewProjectPlan } from "@/lib/projects/apply-plan";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import type { ClientProjectPlanJson } from "@/lib/types/client";
import { createClient } from "@/lib/supabase/server";

type Body = {
  artifactId?: number;
  plan?: ClientProjectPlanJson;
  preview?: boolean;
  mode?: "merge" | "replace";
};

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let plan = body.plan ?? null;
  if (!plan && body.artifactId) {
    const artifactId = Number(body.artifactId);
    if (!Number.isInteger(artifactId) || artifactId <= 0) {
      return NextResponse.json({ error: "Invalid artifactId" }, { status: 400 });
    }
    const { data: artifact, error } = await supabase
      .from("client_project_artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("project_id", owned.projectId)
      .eq("owner_user_id", user.id)
      .eq("artifact_type", "plan")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!artifact) {
      return NextResponse.json({ error: "Plan artifact not found" }, { status: 404 });
    }
    const json = artifact.content_json as ClientProjectPlanJson;
    if (!json?.phases?.length) {
      return NextResponse.json(
        { error: "Plan artifact has no valid plan data" },
        { status: 400 },
      );
    }
    plan = json;
  }

  if (!plan?.phases?.length) {
    return NextResponse.json(
      { error: "plan or artifactId with plan data is required" },
      { status: 400 },
    );
  }

  try {
    if (body.preview) {
      const preview = await previewProjectPlan({
        supabase,
        userId: user.id,
        projectId: owned.projectId,
        plan,
      });
      return NextResponse.json({ preview });
    }

    const result = await applyProjectPlan({
      supabase,
      userId: user.id,
      projectId: owned.projectId,
      clientId: owned.project.client_id,
      plan,
      mode: body.mode === "replace" ? "replace" : "merge",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to apply plan",
      },
      { status: 500 },
    );
  }
}
