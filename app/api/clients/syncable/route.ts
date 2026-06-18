import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns clients that have at least one data connection set up (GSC or GA4)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("clients")
    .select("id,account_name,sc_url,ga4_property_id")
    .order("account_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = (data ?? []).filter(
    (c) => (c.sc_url ?? "").trim() || (c.ga4_property_id ?? "").trim(),
  );

  return NextResponse.json({ clients });
}
