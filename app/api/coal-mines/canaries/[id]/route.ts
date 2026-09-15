import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Pausing, renaming and deleting a canary somebody wrote. */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Unknown canary." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { enabled?: boolean; name?: string; watches?: string; severity?: string }
    | null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (body?.name?.trim()) patch.name = body.name.trim();
  if (body?.watches?.trim()) patch.watches = body.watches.trim();
  if (body?.severity === "attention" || body?.severity === "overdue") {
    patch.severity = body.severity;
  }
  // The query itself is deliberately not editable here: changing it by hand
  // would skip the preview, which is the only thing that shows what it does.
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("coal_mine_canaries")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ canary: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Unknown canary." }, { status: 400 });
  }

  const { error } = await createAdminClient().from("coal_mine_canaries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
