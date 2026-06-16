import { NextResponse } from "next/server";
import { getOwnedProjectOrThrow } from "@/lib/projects/access";
import { parseProjectId } from "@/lib/projects/shared";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const params = await context.params;
  const projectId = parseProjectId(params.id);
  const attachmentId = parseProjectId(params.attachmentId);
  if (!projectId || !attachmentId) {
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

  const { data: attachmentRaw, error: attachmentError } = await supabase
    .from("client_project_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("project_id", owned.projectId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (attachmentError) {
    return NextResponse.json({ error: attachmentError.message }, { status: 500 });
  }
  if (!attachmentRaw) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const storagePath = String(attachmentRaw.storage_path ?? "");
  if (storagePath) {
    await supabase.storage.from("task-documents").remove([storagePath]);
  }

  const { error: deleteError } = await supabase
    .from("client_project_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("owner_user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
