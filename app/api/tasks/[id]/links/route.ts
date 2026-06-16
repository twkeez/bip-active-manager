import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedTaskOrThrow, parsePositiveInt } from "@/lib/tasks/task-access";
import type { UserTaskLink } from "@/lib/types/client";

type CreateLinkBody = {
  label?: string;
  url?: string;
};

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeUrl(value: string) {
  const raw = normalize(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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
    .from("user_task_links")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ links: (data ?? []) as UserTaskLink[] });
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

  let body: CreateLinkBody;
  try {
    body = (await request.json()) as CreateLinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = normalize(body.label);
  const url = normalizeUrl(body.url ?? "");
  if (!label || !url) {
    return NextResponse.json(
      { error: "Both link label and url are required" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_task_links")
    .insert({
      owner_user_id: user.id,
      task_id: task.id,
      label,
      url,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create link" },
      { status: 500 },
    );
  }
  return NextResponse.json({ link: data as UserTaskLink });
}
