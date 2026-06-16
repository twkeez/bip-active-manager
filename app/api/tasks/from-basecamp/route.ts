import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BasecampThreadEvent, UserTask, UserTaskSource } from "@/lib/types/client";
import { joinTasksWithSources } from "@/lib/tasks/shared";

type CreateFromBasecampBody = {
  clientId?: number;
  basecampProjectId?: string;
  basecampRecordingId?: number;
};

function normalizeRecordingId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeProjectId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isUniqueViolation(message: string | undefined) {
  if (!message) return false;
  return /duplicate key value|unique constraint/i.test(message);
}

function buildTaskTitle(event: BasecampThreadEvent | null, projectId: string) {
  const threadTitle = (event?.thread_title ?? "").trim();
  if (threadTitle) return `Follow up: ${threadTitle}`;
  const excerpt =
    (event?.thread_excerpt ?? "").trim() || (event?.thread_body ?? "").trim();
  if (excerpt) {
    const shortened = excerpt.length > 72 ? `${excerpt.slice(0, 69)}...` : excerpt;
    return `Follow up: ${shortened}`;
  }
  return `Follow up on Basecamp thread ${projectId}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateFromBasecampBody;
  try {
    body = (await request.json()) as CreateFromBasecampBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const basecampProjectId = normalizeProjectId(body.basecampProjectId);
  const basecampRecordingId = normalizeRecordingId(body.basecampRecordingId);
  const clientId = normalizeRecordingId(body.clientId);
  if (!basecampProjectId || !basecampRecordingId) {
    return NextResponse.json(
      { error: "basecampProjectId and basecampRecordingId are required" },
      { status: 400 },
    );
  }

  const externalId = `${basecampProjectId}:${basecampRecordingId}`;
  const { data: existingSourceRaw } = await supabase
    .from("user_task_sources")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("source_type", "basecamp_thread")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existingSourceRaw) {
    const existingSource = existingSourceRaw as UserTaskSource;
    const { data: existingTaskRaw } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", existingSource.task_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (existingTaskRaw) {
      const task = joinTasksWithSources(
        [existingTaskRaw as UserTask],
        [existingSource],
      )[0];
      return NextResponse.json({ created: false, task });
    }
  }

  let eventQuery = supabase
    .from("basecamp_communication_events")
    .select("*")
    .eq("basecamp_project_id", basecampProjectId)
    .eq("basecamp_recording_id", basecampRecordingId)
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (clientId) {
    eventQuery = eventQuery.eq("client_id", clientId);
  }
  const { data: directEventsRaw } = await eventQuery;

  let threadEvent = ((directEventsRaw ?? [])[0] as BasecampThreadEvent | undefined) ?? null;
  if (!threadEvent) {
    let commentQuery = supabase
      .from("basecamp_communication_events")
      .select("*")
      .eq("basecamp_project_id", basecampProjectId)
      .eq("parent_recording_id", basecampRecordingId)
      .order("occurred_at", { ascending: false })
      .limit(1);
    if (clientId) {
      commentQuery = commentQuery.eq("client_id", clientId);
    }
    const { data: commentsRaw } = await commentQuery;
    threadEvent = ((commentsRaw ?? [])[0] as BasecampThreadEvent | undefined) ?? null;
  }

  const nowIso = new Date().toISOString();
  const { data: insertedTaskRaw, error: insertTaskError } = await supabase
    .from("user_tasks")
    .insert({
      owner_user_id: user.id,
      title: buildTaskTitle(threadEvent, basecampProjectId),
      notes: threadEvent?.thread_excerpt ?? null,
      status: "not_started",
      priority: "medium",
      source_type: "basecamp",
      updated_at: nowIso,
      created_at: nowIso,
    })
    .select("*")
    .single();
  if (insertTaskError || !insertedTaskRaw) {
    return NextResponse.json(
      { error: insertTaskError?.message ?? "Failed to create task" },
      { status: 500 },
    );
  }

  const insertedTask = insertedTaskRaw as UserTask;
  const { data: insertedSourceRaw, error: insertSourceError } = await supabase
    .from("user_task_sources")
    .insert({
      owner_user_id: user.id,
      task_id: insertedTask.id,
      source_type: "basecamp_thread",
      external_id: externalId,
      source_url: threadEvent?.thread_url ?? null,
      payload: {
        client_id: threadEvent?.client_id ?? clientId ?? null,
        basecamp_project_id: basecampProjectId,
        basecamp_recording_id: basecampRecordingId,
        thread_title: threadEvent?.thread_title ?? null,
        thread_excerpt: threadEvent?.thread_excerpt ?? null,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (insertSourceError || !insertedSourceRaw) {
    if (isUniqueViolation(insertSourceError?.message)) {
      const { data: sourceRaw } = await supabase
        .from("user_task_sources")
        .select("*")
        .eq("owner_user_id", user.id)
        .eq("source_type", "basecamp_thread")
        .eq("external_id", externalId)
        .maybeSingle();
      if (sourceRaw) {
        const source = sourceRaw as UserTaskSource;
        const { data: taskRaw } = await supabase
          .from("user_tasks")
          .select("*")
          .eq("id", source.task_id)
          .eq("owner_user_id", user.id)
          .maybeSingle();
        await supabase
          .from("user_tasks")
          .delete()
          .eq("id", insertedTask.id)
          .eq("owner_user_id", user.id);
        if (taskRaw) {
          const task = joinTasksWithSources([taskRaw as UserTask], [source])[0];
          return NextResponse.json({ created: false, task });
        }
      }
    }

    return NextResponse.json(
      { error: insertSourceError?.message ?? "Failed to link Basecamp source" },
      { status: 500 },
    );
  }

  const task = joinTasksWithSources([insertedTask], [insertedSourceRaw as UserTaskSource])[0];
  return NextResponse.json({ created: true, task });
}
