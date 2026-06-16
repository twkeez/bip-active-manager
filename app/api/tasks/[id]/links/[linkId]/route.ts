import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedTaskOrThrow, parsePositiveInt } from "@/lib/tasks/task-access";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; linkId: string }> },
) {
  const params = await context.params;
  const taskId = parsePositiveInt(params.id);
  const linkId = parsePositiveInt(params.linkId);
  if (!taskId || !linkId) {
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

  const { data, error } = await supabase
    .from("user_task_links")
    .delete()
    .eq("id", linkId)
    .eq("task_id", task.id)
    .eq("owner_user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
