import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTaskEmailForwardingDomain } from "@/lib/env";
import { generateInboxToken } from "@/lib/tasks/email-ingest";
import type { UserTaskEmailToken } from "@/lib/types/client";

type TokenResponse = {
  token: string;
  forwardingAddress: string;
};

function buildResponse(token: string): TokenResponse {
  const domain = getTaskEmailForwardingDomain();
  return {
    token,
    forwardingAddress: `tasks+${token}@${domain}`,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existingRaw, error: existingError } = await supabase
    .from("user_task_email_tokens")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existingRaw) {
    const existing = existingRaw as UserTaskEmailToken;
    return NextResponse.json(buildResponse(existing.inbox_token));
  }

  const nowIso = new Date().toISOString();
  const inboxToken = generateInboxToken();
  const { data: insertedRaw, error: insertError } = await supabase
    .from("user_task_email_tokens")
    .insert({
      owner_user_id: user.id,
      inbox_token: inboxToken,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (insertError || !insertedRaw) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create inbox token" },
      { status: 500 },
    );
  }

  return NextResponse.json(buildResponse((insertedRaw as UserTaskEmailToken).inbox_token));
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const inboxToken = generateInboxToken();
  const { data: upsertedRaw, error: upsertError } = await supabase
    .from("user_task_email_tokens")
    .upsert(
      {
        owner_user_id: user.id,
        inbox_token: inboxToken,
        updated_at: nowIso,
      },
      { onConflict: "owner_user_id" },
    )
    .select("*")
    .single();
  if (upsertError || !upsertedRaw) {
    return NextResponse.json(
      { error: upsertError?.message ?? "Failed to rotate inbox token" },
      { status: 500 },
    );
  }

  return NextResponse.json(buildResponse((upsertedRaw as UserTaskEmailToken).inbox_token));
}
