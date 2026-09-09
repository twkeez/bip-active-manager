import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import {
  SERVICE_EXPECTATION_BLOCK_KEYS,
  type ExpectationBlock,
} from "@/lib/onboarding/service-expectations";

const VALID_KEYS = new Set<string>(SERVICE_EXPECTATION_BLOCK_KEYS);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("service_expectation_blocks")
    .select("block_key, body, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocks: (data ?? []) as ExpectationBlock[] });
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

  let body: { blocks?: Array<{ block_key?: string; body?: string }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const updates = (body.blocks ?? []).filter(
    (b): b is { block_key: string; body: string } =>
      typeof b?.block_key === "string" && VALID_KEYS.has(b.block_key) && typeof b.body === "string",
  );
  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid blocks to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  // Upsert rather than update: a newly added field has no row yet, and an
  // update would report success while writing nothing. That is how the first
  // draft of "What this isn't" would have vanished on save.
  const { error: writeError } = await admin.from("service_expectation_blocks").upsert(
    updates.map((block) => ({
      block_key: block.block_key,
      body: block.body,
      sort_order: SERVICE_EXPECTATION_BLOCK_KEYS.indexOf(block.block_key),
      updated_at: now,
    })),
    { onConflict: "block_key" },
  );
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  const { data, error } = await admin
    .from("service_expectation_blocks")
    .select("block_key, body, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blocks: (data ?? []) as ExpectationBlock[] });
}
