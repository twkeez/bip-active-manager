import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPage2Opportunities } from "@/lib/seo/page2-opportunities";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = Number(url.searchParams.get("clientId"));
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const { data: snapshot } = await supabase
    .from("client_gsc_snapshots")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) {
    return NextResponse.json({ rows: [] });
  }

  const { data, error } = await supabase
    .from("client_gsc_query_metrics")
    .select("query, impressions, clicks, position")
    .eq("snapshot_id", snapshot.id)
    .order("impressions", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: buildPage2Opportunities(data ?? []) });
}
