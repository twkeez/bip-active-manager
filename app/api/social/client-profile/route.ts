import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialClientProfile } from "@/lib/social/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_client_profiles")
    .select("*")
    .eq("client_id", Number(clientId))
    .maybeSingle<SocialClientProfile>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

// Open to all authenticated team members — strategists maintain their clients' profiles.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId: number } & Partial<SocialClientProfile>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { clientId, specialty, tone, notes, standing_campaigns, posts_per_week } = body;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_client_profiles")
    .upsert({
      client_id: clientId,
      specialty: specialty ?? null,
      tone: tone ?? null,
      notes: notes ?? null,
      standing_campaigns: standing_campaigns ?? [],
      posts_per_week: posts_per_week ?? 3,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id" })
    .select("*")
    .single<SocialClientProfile>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
