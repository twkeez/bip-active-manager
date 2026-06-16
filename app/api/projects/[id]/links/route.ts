import { NextResponse } from "next/server";
import { getOwnedProjectOrThrow, listProjectLinks } from "@/lib/projects/access";
import { createClient } from "@/lib/supabase/server";
import type { ClientProjectLink } from "@/lib/types/client";

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

  const links = await listProjectLinks(supabase, user.id, owned.projectId);
  return NextResponse.json({ links });
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
    .from("client_project_links")
    .insert({
      owner_user_id: user.id,
      project_id: owned.projectId,
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

  await supabase
    .from("client_projects")
    .update({ updated_at: nowIso })
    .eq("id", owned.projectId)
    .eq("owner_user_id", user.id);

  return NextResponse.json({ link: data as ClientProjectLink });
}
