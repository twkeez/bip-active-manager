import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { SERVICE_TIER_TABLES } from "@/lib/services/tier-content";
import { PARTNERSHIP_DEFAULT } from "@/lib/services/partnership-content";

const DEFAULTS: Record<string, unknown> = {
  tiers: SERVICE_TIER_TABLES,
  partnership: PARTNERSHIP_DEFAULT,
};

function isValidKey(key: string): key is keyof typeof DEFAULTS | string {
  return key in DEFAULTS;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!isValidKey(key)) return NextResponse.json({ error: "Unknown content key" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("service_content")
    .select("data")
    .eq("content_key", key)
    .maybeSingle<{ data: unknown }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fall back to the code default until an admin saves an edited version.
  const content = data?.data ?? DEFAULTS[key];
  return NextResponse.json({ data: content });
}

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!isValidKey(key)) return NextResponse.json({ error: "Unknown content key" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: { data?: unknown };
  try {
    body = (await request.json()) as { data?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.data === undefined) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("service_content")
    .upsert({ content_key: key, data: body.data, updated_at: new Date().toISOString() }, { onConflict: "content_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
