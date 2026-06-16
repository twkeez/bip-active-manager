import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedTaskOrThrow, parsePositiveInt } from "@/lib/tasks/task-access";
import type { UserTaskAttachment } from "@/lib/types/client";

type CreateAttachmentBody = {
  storagePath?: string;
  fileName?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = parsePositiveInt(params.id);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
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
    .from("user_task_attachments")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attachments: (data ?? []) as UserTaskAttachment[] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = parsePositiveInt(params.id);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
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

  let body: CreateAttachmentBody;
  try {
    body = (await request.json()) as CreateAttachmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storagePath = normalize(body.storagePath);
  const fileName = normalize(body.fileName);
  if (!storagePath || !fileName) {
    return NextResponse.json(
      { error: "storagePath and fileName are required" },
      { status: 400 },
    );
  }
  const expectedPrefix = `${user.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid storage path prefix" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_task_attachments")
    .insert({
      owner_user_id: user.id,
      task_id: task.id,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: normalize(body.mimeType) || null,
      size_bytes:
        typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
          ? Math.max(0, Math.floor(body.sizeBytes))
          : null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save attachment metadata" },
      { status: 500 },
    );
  }
  return NextResponse.json({ attachment: data as UserTaskAttachment });
}
