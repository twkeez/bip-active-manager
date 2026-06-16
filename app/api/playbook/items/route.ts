import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const body = await req.json();

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
