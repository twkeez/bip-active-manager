import { NextResponse } from "next/server";
import { getOwnedProjectOrThrow, listProjectTasksGrouped } from "@/lib/projects/access";
import { createClient } from "@/lib/supabase/server";

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

  try {
    const grouped = await listProjectTasksGrouped(
      supabase,
      user.id,
      owned.projectId,
    );
    return NextResponse.json(grouped);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load project tasks",
      },
      { status: 500 },
    );
  }
}
