import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";
import { modifyMessageLabels, trashMessage } from "@/lib/gmail/client";
import { upsertSenderRule } from "@/lib/gmail/rules";
import { joinTasksWithSources } from "@/lib/tasks/shared";
import type { UserTask, UserTaskSource } from "@/lib/types/client";
import { buildEmailExternalId } from "@/lib/tasks/email-ingest";
import type { UserEmailMessageRow } from "@/lib/gmail/types";

type ActionBody = {
  messageId?: number;
  action?:
    | "archive"
    | "trash"
    | "mark_read"
    | "mark_unread"
    | "star"
    | "unstar"
    | "create_task"
    | "blacklist_sender"
    | "always_high_priority_sender"
    | "set_high_priority"
    | "set_needs_action";
  value?: boolean;
};

async function loadMessage(admin: ReturnType<typeof createAdminClient>, userId: string, messageId: number) {
  const { data, error } = await admin
    .from("user_email_messages")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Email message not found");
  return data as UserEmailMessageRow;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const messageId = Number(body.messageId);
  if (!Number.isInteger(messageId) || messageId <= 0 || !body.action) {
    return NextResponse.json({ error: "Valid messageId and action are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const message = await loadMessage(admin, user.id, messageId);
    const token = await getGmailAccessTokenForUser(admin, user.id);
    const now = new Date().toISOString();

    if (body.action === "archive") {
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { removeLabelIds: ["INBOX"] });
      await admin.from("user_email_messages").update({ triage_status: "archived", needs_action: false, updated_at: now }).eq("id", message.id);
    } else if (body.action === "trash") {
      await trashMessage(token.accessToken, message.gmail_message_id);
      await admin.from("user_email_messages").update({ triage_status: "deleted", needs_action: false, updated_at: now }).eq("id", message.id);
    } else if (body.action === "mark_read") {
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { removeLabelIds: ["UNREAD"] });
      await admin.from("user_email_messages").update({ is_read: true, updated_at: now }).eq("id", message.id);
    } else if (body.action === "mark_unread") {
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { addLabelIds: ["UNREAD"] });
      await admin.from("user_email_messages").update({ is_read: false, updated_at: now }).eq("id", message.id);
    } else if (body.action === "star") {
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { addLabelIds: ["STARRED"] });
      await admin.from("user_email_messages").update({ is_starred: true, is_high_priority: true, updated_at: now }).eq("id", message.id);
    } else if (body.action === "unstar") {
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { removeLabelIds: ["STARRED"] });
      await admin.from("user_email_messages").update({ is_starred: false, updated_at: now }).eq("id", message.id);
    } else if (body.action === "set_high_priority") {
      const next = body.value !== false;
      await admin.from("user_email_messages").update({ is_high_priority: next, updated_at: now }).eq("id", message.id);
    } else if (body.action === "set_needs_action") {
      const next = body.value !== false;
      await admin
        .from("user_email_messages")
        .update({
          needs_action: next,
          // triage_status tracks where the message lives; needs_action is the
          // flag on top of it. Clearing the flag returns it to the inbox.
          triage_status: next ? "needs_action" : "inbox",
          updated_at: now,
        })
        .eq("id", message.id);
    } else if (body.action === "always_high_priority_sender") {
      if (!message.from_email) throw new Error("Sender email missing");
      const active = body.value !== false;
      await upsertSenderRule(admin, {
        userId: user.id,
        sender: message.from_email,
        ruleType: "always_high_priority",
        isActive: active,
      });
      // Apply the rule to mail already in the store, not just future sync —
      // otherwise marking a sender important appears to do nothing.
      if (active) {
        await admin
          .from("user_email_messages")
          .update({ is_high_priority: true, updated_at: now })
          .eq("owner_user_id", user.id)
          .eq("from_email", message.from_email);
      }
    } else if (body.action === "blacklist_sender") {
      if (!message.from_email) throw new Error("Sender email missing");
      await upsertSenderRule(admin, {
        userId: user.id,
        sender: message.from_email,
        ruleType: "blacklist",
        isActive: true,
      });
      await modifyMessageLabels(token.accessToken, message.gmail_message_id, { removeLabelIds: ["INBOX"] });
      await admin.from("user_email_messages").update({ triage_status: "archived", needs_action: false, updated_at: now }).eq("id", message.id);
    } else if (body.action === "create_task") {
      if (message.task_id) {
        const { data: taskRaw } = await admin.from("user_tasks").select("*").eq("id", message.task_id).eq("owner_user_id", user.id).maybeSingle();
        return NextResponse.json({ created: false, task: taskRaw });
      }
      const externalId = buildEmailExternalId({
        from: message.from_email ?? undefined,
        subject: message.subject ?? undefined,
        date: message.internal_date ?? undefined,
        messageId: message.gmail_message_id,
        text: message.body_text ?? undefined,
      });
      const existingSource = await admin
        .from("user_task_sources")
        .select("*")
        .eq("owner_user_id", user.id)
        .eq("source_type", "email_forward")
        .eq("external_id", externalId)
        .maybeSingle();
      if (existingSource.data) {
        const source = existingSource.data as UserTaskSource;
        const { data: existingTask } = await admin
          .from("user_tasks")
          .select("*")
          .eq("id", source.task_id)
          .eq("owner_user_id", user.id)
          .maybeSingle<UserTask>();
        if (existingTask) {
          await admin.from("user_email_messages").update({ task_id: existingTask.id, needs_action: true, triage_status: "needs_action", updated_at: now }).eq("id", message.id);
          return NextResponse.json({ created: false, task: joinTasksWithSources([existingTask], [source])[0] });
        }
      }

      const insertedTask = await admin
        .from("user_tasks")
        .insert({
          owner_user_id: user.id,
          title: message.subject?.trim() || `Follow up: ${message.from_email ?? "Email"}`,
          notes: [message.from_email ? `From: ${message.from_email}` : "", message.snippet ?? ""].filter(Boolean).join("\n"),
          status: "not_started",
          priority: "medium",
          source_type: "email",
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single<UserTask>();
      if (insertedTask.error || !insertedTask.data) {
        throw new Error(insertedTask.error?.message ?? "Failed to create task");
      }
      const insertedSource = await admin
        .from("user_task_sources")
        .insert({
          owner_user_id: user.id,
          task_id: insertedTask.data.id,
          source_type: "email_forward",
          external_id: externalId,
          source_url: null,
          payload: {
            gmail_message_id: message.gmail_message_id,
            gmail_thread_id: message.gmail_thread_id,
            from: message.from_email,
            subject: message.subject,
          },
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single<UserTaskSource>();
      if (insertedSource.error || !insertedSource.data) {
        throw new Error(insertedSource.error?.message ?? "Failed to create task source");
      }
      await admin.from("user_email_messages").update({ task_id: insertedTask.data.id, needs_action: true, triage_status: "needs_action", updated_at: now }).eq("id", message.id);
      return NextResponse.json({
        created: true,
        task: joinTasksWithSources([insertedTask.data], [insertedSource.data])[0],
      });
    } else {
      throw new Error("Unsupported action");
    }

    await admin.from("user_email_triage_events").insert({
      owner_user_id: user.id,
      message_id: message.id,
      event_type: body.action,
      metadata: { value: body.value ?? null },
      created_at: now,
    });

    const refreshed = await loadMessage(admin, user.id, message.id);
    return NextResponse.json({ ok: true, message: refreshed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run Gmail action" },
      { status: 500 },
    );
  }
}
