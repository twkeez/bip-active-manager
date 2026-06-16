import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTaskEmailIngestConfig } from "@/lib/env";
import {
  buildEmailExcerpt,
  buildEmailExternalId,
  buildEmailTaskTitle,
  extractTokenFromToAddresses,
  type EmailForwardPayload,
} from "@/lib/tasks/email-ingest";
import type { UserTask, UserTaskEmailToken, UserTaskSource } from "@/lib/types/client";
import { joinTasksWithSources } from "@/lib/tasks/shared";

function extractSecret(request: Request, bodySecret: unknown) {
  const headerSecret = request.headers.get("x-tasks-ingest-secret");
  if (headerSecret && headerSecret.trim()) return headerSecret.trim();
  if (typeof bodySecret === "string" && bodySecret.trim()) return bodySecret.trim();
  return "";
}

export async function POST(request: Request) {
  let body: EmailForwardPayload & { secret?: string };
  try {
    body = (await request.json()) as EmailForwardPayload & { secret?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let expectedSecret = "";
  try {
    expectedSecret = getTaskEmailIngestConfig().secret;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Email ingest is not configured",
      },
      { status: 500 },
    );
  }

  const providedSecret = extractSecret(request, body.secret);
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized ingest request" }, { status: 401 });
  }

  const inboxToken = extractTokenFromToAddresses(body);
  if (!inboxToken) {
    return NextResponse.json(
      { error: "Could not determine user inbox token from recipient address" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: tokenRowRaw, error: tokenError } = await admin
    .from("user_task_email_tokens")
    .select("*")
    .eq("inbox_token", inboxToken)
    .maybeSingle();
  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }
  if (!tokenRowRaw) {
    return NextResponse.json({ error: "No user found for inbox token" }, { status: 404 });
  }
  const tokenRow = tokenRowRaw as UserTaskEmailToken;

  const externalId = buildEmailExternalId(body);
  const { data: existingSourceRaw } = await admin
    .from("user_task_sources")
    .select("*")
    .eq("owner_user_id", tokenRow.owner_user_id)
    .eq("source_type", "email_forward")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingSourceRaw) {
    const existingSource = existingSourceRaw as UserTaskSource;
    const { data: existingTaskRaw } = await admin
      .from("user_tasks")
      .select("*")
      .eq("id", existingSource.task_id)
      .eq("owner_user_id", tokenRow.owner_user_id)
      .maybeSingle();
    if (existingTaskRaw) {
      const task = joinTasksWithSources(
        [existingTaskRaw as UserTask],
        [existingSource],
      )[0];
      return NextResponse.json({ created: false, task });
    }
  }

  const nowIso = new Date().toISOString();
  const excerpt = buildEmailExcerpt(body);
  const sender = (body.from ?? "").trim();
  const date = (body.date ?? "").trim();
  const noteLines = [sender ? `From: ${sender}` : "", date ? `Date: ${date}` : "", excerpt ?? ""]
    .filter(Boolean)
    .join("\n");

  const { data: insertedTaskRaw, error: insertTaskError } = await admin
    .from("user_tasks")
    .insert({
      owner_user_id: tokenRow.owner_user_id,
      title: buildEmailTaskTitle(body),
      notes: noteLines || null,
      status: "not_started",
      priority: "medium",
      source_type: "email",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (insertTaskError || !insertedTaskRaw) {
    return NextResponse.json(
      { error: insertTaskError?.message ?? "Failed to create task from email" },
      { status: 500 },
    );
  }

  const insertedTask = insertedTaskRaw as UserTask;
  const { data: insertedSourceRaw, error: insertSourceError } = await admin
    .from("user_task_sources")
    .insert({
      owner_user_id: tokenRow.owner_user_id,
      task_id: insertedTask.id,
      source_type: "email_forward",
      external_id: externalId,
      payload: {
        to: body.to ?? null,
        from: body.from ?? null,
        subject: body.subject ?? null,
        date: body.date ?? null,
        message_id: body.messageId ?? null,
        excerpt,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (insertSourceError || !insertedSourceRaw) {
    await admin
      .from("user_tasks")
      .delete()
      .eq("id", insertedTask.id)
      .eq("owner_user_id", tokenRow.owner_user_id);
    return NextResponse.json(
      { error: insertSourceError?.message ?? "Failed to link email source" },
      { status: 500 },
    );
  }

  const task = joinTasksWithSources([insertedTask], [insertedSourceRaw as UserTaskSource])[0];
  return NextResponse.json({ created: true, task });
}
