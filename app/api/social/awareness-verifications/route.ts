import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialAwarenessVerification } from "@/lib/social/types";

/**
 * Which (year, month) pairs have had their seasonal dates confirmed.
 * A row's existence IS the verification — awareness days shift year to year,
 * so an unverified month's list is not shown at all.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_awareness_verifications")
    .select("*")
    .order("year", { ascending: false })
    .order("month")
    .returns<SocialAwarenessVerification[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ verifications: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { year?: number; month?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year must be between 2000 and 2100" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_awareness_verifications")
    .upsert(
      { year, month, verified_by: user.email ?? null, verified_at: new Date().toISOString() },
      { onConflict: "year,month" },
    )
    .select("*")
    .single<SocialAwarenessVerification>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
