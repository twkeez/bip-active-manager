import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";

type SopRow = {
  item_key: string;
  label: string;
  category: string;
  phase: string;
  severity: string;
  sort_order: number;
  guidance: string | null;
};

const SELECT = "item_key, label, category, phase, severity, sort_order, guidance";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("client_onboarding_templates")
    .select(SELECT)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ steps: (data ?? []) as SopRow[] });
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

  let body: { items?: Array<{ item_key?: string; guidance?: string | null }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const updates = (body.items ?? []).filter(
    (i): i is { item_key: string; guidance: string | null } =>
      typeof i?.item_key === "string" && i.item_key.length > 0,
  );
  if (updates.length === 0) {
    return NextResponse.json({ error: "No steps to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  for (const step of updates) {
    const guidance = typeof step.guidance === "string" && step.guidance.trim() ? step.guidance : null;
    const { error: tplError } = await admin
      .from("client_onboarding_templates")
      .update({ guidance, updated_at: now })
      .eq("item_key", step.item_key);
    if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });
    // Push the edit onto every already-seeded per-client item.
    const { error: itemError } = await admin
      .from("client_onboarding_items")
      .update({ guidance, updated_at: now })
      .eq("item_key", step.item_key);
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("client_onboarding_templates")
    .select(SELECT)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, steps: (data ?? []) as SopRow[] });
}
