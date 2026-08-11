import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { generateSocialPlan } from "@/lib/social/plan-generator";
import type { SocialIdea, SocialClientProfile, SocialContentPlan, SocialContentPost } from "@/lib/social/types";

type GenerateBody = {
  clientId: number;
  clientName: string;
  month: number;
  year: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: GenerateBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { clientId, clientName, month, year } = body;
  if (!clientId || !clientName || !month || !year) {
    return NextResponse.json({ error: "clientId, clientName, month, year required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load client profile, active ideas, and last 3 months of plans in parallel
  const [profileRes, ideasRes, historyRes] = await Promise.all([
    admin.from("social_client_profiles").select("*").eq("client_id", clientId).maybeSingle<SocialClientProfile>(),
    admin.from("social_idea_repository").select("*").eq("is_active", true).order("campaign_type").returns<SocialIdea[]>(),
    admin.from("social_content_plans").select("campaign_types_used").eq("client_id", clientId)
      .order("plan_year", { ascending: false }).order("plan_month", { ascending: false }).limit(3)
      .returns<Pick<SocialContentPlan, "campaign_types_used">[]>(),
  ]);

  const clientProfile = profileRes.data;
  const ideas = ideasRes.data ?? [];
  const recentCampaignTypes = [...new Set((historyRes.data ?? []).flatMap((p) => p.campaign_types_used))];

  const posts = await generateSocialPlan({
    apiKey,
    clientName,
    month,
    year,
    specialty: clientProfile?.specialty ?? null,
    tone: clientProfile?.tone ?? null,
    notes: clientProfile?.notes ?? null,
    standingCampaigns: (clientProfile?.standing_campaigns as { name: string; description: string }[]) ?? [],
    postsPerWeek: clientProfile?.posts_per_week ?? 3,
    ideas,
    recentCampaignTypes,
  });

  // Upsert the plan (replace if exists for this month/year)
  const { data: existingPlan } = await admin
    .from("social_content_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("plan_month", month)
    .eq("plan_year", year)
    .maybeSingle<{ id: number }>();

  const campaignTypesUsed = [...new Set(posts.map((p) => p.campaign_type))];
  const awarenessNamesUsed = posts
    .filter((p) => p.campaign_type === "awareness_day")
    .map((p) => p.campaign_label);

  let planId: number;

  if (existingPlan) {
    // Delete old posts then update plan
    await admin.from("social_content_posts").delete().eq("plan_id", existingPlan.id);
    await admin.from("social_content_plans").update({
      campaign_types_used: campaignTypesUsed,
      awareness_days_used: awarenessNamesUsed,
      status: "draft",
      updated_at: new Date().toISOString(),
    }).eq("id", existingPlan.id);
    planId = existingPlan.id;
  } else {
    const { data: newPlan, error: planError } = await admin
      .from("social_content_plans")
      .insert({
        client_id: clientId,
        plan_month: month,
        plan_year: year,
        campaign_types_used: campaignTypesUsed,
        awareness_days_used: awarenessNamesUsed,
        created_by: user.email,
      })
      .select("id")
      .single<{ id: number }>();
    if (planError || !newPlan) return NextResponse.json({ error: planError?.message ?? "Failed to create plan" }, { status: 500 });
    planId = newPlan.id;
  }

  const postRows = posts.map((p, i) => ({
    plan_id: planId,
    client_id: clientId,
    post_date: p.post_date,
    platform: p.platform,
    campaign_type: p.campaign_type,
    campaign_label: p.campaign_label,
    caption_draft: p.caption_draft,
    shot_list: p.shot_list,
    hashtags: p.hashtags,
    status: "idea" as const,
    sort_order: i,
  }));

  const { error: insertError } = await admin.from("social_content_posts").insert(postRows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: savedPosts } = await admin
    .from("social_content_posts")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order")
    .returns<SocialContentPost[]>();

  const { data: savedPlan } = await admin
    .from("social_content_plans")
    .select("*")
    .eq("id", planId)
    .single<SocialContentPlan>();

  return NextResponse.json({ plan: savedPlan, posts: savedPosts ?? [] });
}
