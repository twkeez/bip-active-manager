import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFreshIdeas } from "@/lib/social/idea-brainstorm";
import type { SocialClientProfile, StandingCampaign } from "@/lib/social/types";

export const maxDuration = 300;

type Body = {
  clientId?: number;
  month?: number;
  exclude?: string[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = Number(body.clientId);
  const month = Number(body.month);
  if (!clientId || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "clientId and month required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [clientRes, profileRes] = await Promise.all([
    admin.from("clients").select("account_name, website").eq("id", clientId).maybeSingle<{ account_name: string; website: string | null }>(),
    admin.from("social_client_profiles").select("*").eq("client_id", clientId).maybeSingle<SocialClientProfile>(),
  ]);

  if (!clientRes.data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const profile = profileRes.data;

  try {
    const ideas = await generateFreshIdeas({
      apiKey,
      clientName: clientRes.data.account_name,
      website: clientRes.data.website,
      month,
      specialty: profile?.specialty ?? null,
      tone: profile?.tone ?? null,
      notes: profile?.notes ?? null,
      standingCampaigns: (profile?.standing_campaigns as StandingCampaign[]) ?? [],
      exclude: (body.exclude ?? []).filter((t) => typeof t === "string" && t.trim()),
    });
    if (ideas.length === 0) return NextResponse.json({ error: "The model returned no ideas. Try again." }, { status: 502 });
    return NextResponse.json({ ideas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Brainstorm failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
