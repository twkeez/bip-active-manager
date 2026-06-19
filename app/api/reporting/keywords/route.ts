import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UpsertKeyword = {
  id?: number;
  keyword?: string;
  tag?: string | null;
  priority?: number;
  isActive?: boolean;
};

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeKeyword(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizePriority(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return Math.max(1, Math.min(100, parsed));
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = parseClientId(url.searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; upserts?: UpsertKeyword[]; deleteIds?: number[] };
  try {
    body = (await request.json()) as { clientId?: number; upserts?: UpsertKeyword[]; deleteIds?: number[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  if (Array.isArray(body.deleteIds) && body.deleteIds.length > 0) {
    const deleteIds = body.deleteIds.filter((id) => Number.isInteger(id) && id > 0);
    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from("client_keyword_targets")
        .delete()
        .eq("owner_user_id", user.id)
        .eq("client_id", clientId)
        .in("id", deleteIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.upserts) && body.upserts.length > 0) {
    const newRows: Array<{
      owner_user_id: string;
      client_id: number;
      keyword: string;
      tag: string | null;
      priority: number;
      is_active: boolean;
      updated_at: string;
    }> = [];
    const existingRows: Array<{ id: number; owner_user_id: string; client_id: number; keyword: string; tag: string | null; priority: number; is_active: boolean; updated_at: string }> = [];

    for (const item of body.upserts) {
      const keyword = normalizeKeyword(item.keyword);
      if (!keyword) continue;
      const base = {
        owner_user_id: user.id,
        client_id: clientId,
        keyword,
        tag: item.tag == null ? null : String(item.tag).trim() || null,
        priority: normalizePriority(item.priority),
        is_active: item.isActive ?? true,
        updated_at: new Date().toISOString(),
      };
      const hasId = Number.isInteger(item.id) && Number(item.id) > 0;
      if (hasId) {
        existingRows.push({ id: Number(item.id), ...base });
      } else {
        newRows.push(base);
      }
    }

    if (newRows.length > 0) {
      const { error } = await supabase.from("client_keyword_targets").insert(newRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (existingRows.length > 0) {
      const { error } = await supabase
        .from("client_keyword_targets")
        .upsert(existingRows, { onConflict: "id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
