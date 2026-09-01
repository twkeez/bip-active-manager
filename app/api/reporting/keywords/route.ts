import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";
import { seoKeywordAllowance, defaultSeoKeywords } from "@/lib/playbook/client-tiers";

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

// Loads the client's SEO tier allowance (0 / 3 / 10). Returns null if the
// client can't be read (not found or not visible to this user).
async function loadKeywordAllowance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: number,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("seo")
    .eq("id", clientId)
    .maybeSingle<Pick<ClientRow, "seo">>();
  if (error || !data) return null;
  return seoKeywordAllowance({ seo: data.seo } as ClientRow);
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
        .eq("client_id", clientId)
        .in("id", deleteIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.upserts) && body.upserts.length > 0) {
    const newRows: Array<{
      created_by: string | null;
      client_id: number;
      keyword: string;
      tag: string | null;
      priority: number;
      is_active: boolean;
      updated_at: string;
    }> = [];
    const existingRows: Array<{ id: number; client_id: number; keyword: string; tag: string | null; priority: number; is_active: boolean; updated_at: string }> = [];

    for (const item of body.upserts) {
      const keyword = normalizeKeyword(item.keyword);
      if (!keyword) continue;
      const base = {
        created_by: user.id,
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
      // Enforce the SEO-tier keyword allowance. Deletes above have already
      // been applied, so the current count reflects the post-delete state.
      const allowance = await loadKeywordAllowance(supabase, clientId);
      if (allowance === null) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      const { count } = await supabase
        .from("client_keyword_targets")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      const current = count ?? 0;
      if (current + newRows.length > allowance) {
        const message =
          allowance === 0
            ? "The Foundation tier doesn't include keyword tracking."
            : `This tier allows ${allowance} tracked keyword${allowance === 1 ? "" : "s"}.`;
        return NextResponse.json({ error: message }, { status: 409 });
      }
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
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

// Idempotently seeds the tier's default starter keywords for a client that has
// none yet. No-op when the client already has keywords or their SEO tier
// allowance is 0 (Foundation / inactive).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number };
  try {
    body = (await request.json()) as { clientId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("seo, account_name, city")
    .eq("id", clientId)
    .maybeSingle<Pick<ClientRow, "seo" | "account_name" | "city">>();
  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const allowance = seoKeywordAllowance(client as ClientRow);

  const { count } = await supabase
    .from("client_keyword_targets")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  // Only seed from a clean slate and when the tier permits keywords.
  if (allowance > 0 && (count ?? 0) === 0) {
    const defaults = defaultSeoKeywords(client as ClientRow).slice(0, allowance);
    if (defaults.length > 0) {
      const now = new Date().toISOString();
      const rows = defaults.map((keyword) => ({
        created_by: user.id,
        client_id: clientId,
        keyword,
        tag: null,
        priority: 50,
        is_active: true,
        updated_at: now,
      }));
      const { error: insertError } = await supabase.from("client_keyword_targets").insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("client_keyword_targets")
    .select("*")
    .eq("client_id", clientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], allowance });
}
