import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdsAssessmentSnapshot } from "@/lib/types/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId: clientIdRaw } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_ads_assessments")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdsAssessmentSnapshot>();
  if (error) {
    // Table not created yet (migration not applied) — treat as "no assessment".
    if ((error as { code?: string }).code === "42P01") {
      return NextResponse.json({ assessment: null });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessment: data ?? null });
}
