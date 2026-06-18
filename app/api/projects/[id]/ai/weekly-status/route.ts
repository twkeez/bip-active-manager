import { NextResponse } from "next/server";
import { generateClaudeText } from "@/lib/ai/claude";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import { buildProjectAiContext } from "@/lib/projects/context";
import { buildWeeklyStatusPrompt } from "@/lib/projects/prompts";
import { createClient } from "@/lib/supabase/server";
import type { ClientProjectArtifact } from "@/lib/types/client";

export async function POST(
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

  try {
    const ctx = await buildProjectAiContext(supabase, user.id, owned.project);
    const text = await generateClaudeText(buildWeeklyStatusPrompt(ctx));

    const title = `Weekly status — ${new Date().toISOString().slice(0, 10)}`;
    const { data: artifact, error } = await supabase
      .from("client_project_artifacts")
      .insert({
        project_id: owned.projectId,
        owner_user_id: user.id,
        artifact_type: "weekly_status",
        title,
        content_markdown: text,
        content_json: {},
      })
      .select("*")
      .single();
    if (error || !artifact) {
      throw new Error(error?.message ?? "Failed to save weekly status artifact");
    }

    await supabase
      .from("client_projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", owned.projectId)
      .eq("owner_user_id", user.id);

    return NextResponse.json({
      ok: true,
      markdown: text,
      artifact: artifact as ClientProjectArtifact,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate weekly status",
      },
      { status: 500 },
    );
  }
}
