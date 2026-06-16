import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedTaskOrThrow, parsePositiveInt } from "@/lib/tasks/task-access";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const params = await context.params;
  const taskId = parsePositiveInt(params.id);
  const attachmentId = parsePositiveInt(params.attachmentId);
  if (!taskId || !attachmentId) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await fetchOwnedTaskOrThrow(supabase, taskId, user.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: attachmentRaw, error: attachmentError } = await supabase
    .from("user_task_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("task_id", task.id)
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
    .from("user_task_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("owner_user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
