import { NextResponse } from "next/server";
import { generateClaudeContent } from "@/lib/ai/claude";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import { buildProjectAiContext } from "@/lib/projects/context";
import { parseProjectPlanJson } from "@/lib/projects/parse";
import { buildPlanPrompt, planJsonToMarkdown } from "@/lib/projects/prompts";
import { createClient } from "@/lib/supabase/server";
import type { ClientProjectArtifact } from "@/lib/types/client";

type Body = { prompt?: string };

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

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  try {
    const ctx = await buildProjectAiContext(supabase, user.id, owned.project);
    const text = await generateClaudeContent(
      [{ text: buildPlanPrompt(ctx, body.prompt) }],
      { maxOutputTokens: 4096, temperature: 0.35 },
    );

    const plan = parseProjectPlanJson(text);
    if (!plan) {
      throw new Error("Gemini did not return valid plan JSON.");
    }

    const markdown = planJsonToMarkdown(plan);
    const title = `Plan — ${new Date().toISOString().slice(0, 10)}`;
    const { data: artifact, error } = await supabase
      .from("client_project_artifacts")
      .insert({
        project_id: owned.projectId,
        owner_user_id: user.id,
        artifact_type: "plan",
        title,
        content_markdown: markdown,
        content_json: plan,
      })
      .select("*")
      .single();
    if (error || !artifact) {
      throw new Error(error?.message ?? "Failed to save plan artifact");
    }

    await supabase
      .from("client_projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", owned.projectId)
      .eq("owner_user_id", user.id);

    return NextResponse.json({
      ok: true,
      plan,
      markdown,
      artifact: artifact as ClientProjectArtifact,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate plan",
      },
      { status: 500 },
    );
  }
}
