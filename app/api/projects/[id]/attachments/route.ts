import { NextResponse } from "next/server";
import { getOwnedProjectOrThrow, listProjectAttachments } from "@/lib/projects/access";
import { createClient } from "@/lib/supabase/server";
import type { ClientProjectAttachment } from "@/lib/types/client";

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

  const attachments = await listProjectAttachments(supabase, user.id, owned.projectId);
  return NextResponse.json({ attachments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
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
  const expectedPrefix = `${user.id}/projects/${owned.projectId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid storage path prefix" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_project_attachments")
    .insert({
      owner_user_id: user.id,
      project_id: owned.projectId,
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

  await supabase
    .from("client_projects")
    .update({ updated_at: nowIso })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ attachment: data as ClientProjectAttachment });
}
