import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/guard";
import { pickEditableItemFields } from "@/lib/playbook/item-fields";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;
  const changes = pickEditableItemFields(await req.json().catch(() => null));
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("playbook_items")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", Number(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  const { error } = await supabase
    .from("playbook_items")
    .update({ is_active: false })
    .eq("id", Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
