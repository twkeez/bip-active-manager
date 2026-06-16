import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreBasecampProject } from "@/lib/clients/basecamp-project-ignores";

type Params = Promise<{ projectId: string }>;

export async function DELETE(
  _request: Request,
  context: { params: Params },
) {
  const { projectId: projectIdRaw } = await context.params;
  const projectId = decodeURIComponent(projectIdRaw ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await restoreBasecampProject(supabase, projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to restore project",
      },
      { status: 500 },
    );
  }
}
