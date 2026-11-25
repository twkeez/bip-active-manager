import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase
    .from("strategy_mapper_service_tiers")
    .select("*")
    .eq("enabled", true)
    .order("service")
    .order("tier_rank");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
