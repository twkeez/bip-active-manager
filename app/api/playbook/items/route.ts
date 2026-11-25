import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole, requireSignedIn } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const tierKey = req.nextUrl.searchParams.get("tier_key");

  let query = supabase
    .from("playbook_items")
    .select("*")
    .order("sort_order")
    .order("id");
  if (tierKey) query = query.eq("tier_key", tierKey);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const body = await req.json().catch(() => null);
  if (!body?.tier_key || !body?.title) {
    return NextResponse.json({ error: "A tier and a title are required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("playbook_items")
    .insert({
      tier_key: body.tier_key,
      category: body.category ?? "General",
      type: body.type ?? "checklist",
      title: body.title,
      body: body.body ?? null,
      auto_verify_key: body.auto_verify_key ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
