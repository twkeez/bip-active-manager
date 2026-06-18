import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns all clients that are missing ga4_id or google_place_id but have a website set
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("clients")
    .select("id,account_name,website,ga4_id,google_place_id")
    .not("website", "is", null)
    .neq("website", "")
    .order("account_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = (data ?? []).filter(
    (c) => !(c.ga4_id ?? "").trim() || !(c.google_place_id ?? "").trim(),
  );

  return NextResponse.json({ clients });
}
