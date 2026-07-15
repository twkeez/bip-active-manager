import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";

type BestPracticeRow = {
  key: string;
  label: string;
  category: string;
  content: string | null;
  sort_order: number;
};

const SELECT = "key, label, category, content, sort_order";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("best_practices")
    .select(SELECT)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: (data ?? []) as BestPracticeRow[] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: { entries?: Array<{ key?: string; content?: string | null }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const updates = (body.entries ?? []).filter(
    (e): e is { key: string; content: string | null } => typeof e?.key === "string" && e.key.length > 0,
  );
  if (updates.length === 0) {
    return NextResponse.json({ error: "No entries to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  for (const entry of updates) {
    const content = typeof entry.content === "string" ? entry.content : null;
    const { error } = await admin
      .from("best_practices")
      .update({ content, updated_at: now })
      .eq("key", entry.key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("best_practices")
    .select(SELECT)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entries: (data ?? []) as BestPracticeRow[] });
}
