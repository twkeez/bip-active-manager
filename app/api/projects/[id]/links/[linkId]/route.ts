import { NextResponse } from "next/server";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import { parseProjectId } from "@/lib/projects/shared";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; linkId: string }> },
) {
  const params = await context.params;
  const projectId = parseProjectId(params.id);
  const linkId = parseProjectId(params.linkId);
  if (!projectId || !linkId) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

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
    .from("client_project_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", owned.projectId)
    .eq("owner_user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
