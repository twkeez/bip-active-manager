import { NextResponse } from "next/server";
import { sendGmailAs } from "@/lib/email/gmail-send";
import { followupEmailBody } from "@/lib/followups/followups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CreateBody = {
  projectId?: string;
  projectName?: string;
  clientId?: number | null;
  recipientEmail?: string;
  recipientName?: string | null;
  subject?: string;
  note?: string;
  threadTitle?: string | null;
  threadUrl?: string | null;
};

/**
 * "Notify strategist": email a teammate about a client from the sender's own
 * Gmail, then record it as an open follow-up. The row is written only after
 * the email went out, so the follow-up list never shows a note nobody got.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const projectName = body.projectName?.trim();
  const recipientEmail = body.recipientEmail?.trim().toLowerCase();
  const subject = body.subject?.trim();
  const note = body.note?.trim();
  if (!projectId || !projectName || !recipientEmail || !subject || !note) {
    return NextResponse.json(
      { error: "Project, recipient, subject and note are all required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  // Only teammates: this button sends from Tom's Gmail, so it must not be
  // able to email anyone outside the team.
  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", recipientEmail)
    .maybeSingle();
  if (!staff) {
    return NextResponse.json(
      { error: `${recipientEmail} is not a member of the team, so the note was not sent.` },
      { status: 400 },
    );
  }

  const record = {
    basecamp_project_id: projectId,
    project_name: projectName,
    client_id: typeof body.clientId === "number" ? body.clientId : null,
    recipient_name: body.recipientName?.trim() || null,
    recipient_email: recipientEmail,
    subject,
    note,
    thread_title: body.threadTitle?.trim() || null,
    thread_url: body.threadUrl?.trim() || null,
    sent_by_user_id: user.id,
    sent_by_email: user.email ?? null,
  };

  try {
    await sendGmailAs(admin, user.id, {
      to: recipientEmail,
      subject,
      body: followupEmailBody(record),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the email." },
      { status: 502 },
    );
  }

  const { data, error } = await supabase
    .from("strategist_followups")
    .insert(record)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json(
      {
        error: `The email was sent, but the follow-up could not be saved: ${error.message}`,
        emailed: true,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, followup: data });
}
