import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSocialPlan, type SelectedIdea } from "@/lib/social/plan-generator";
import type { SocialIdea, SocialClientProfile, SocialContentPlan, SocialContentPost } from "@/lib/social/types";

export const maxDuration = 300;

type GenerateBody = {
  clientId: number;
  clientName: string;
  month: number;
  year: number;
  selectedIdeas?: SelectedIdea[];
};

// Open to all authenticated team members — strategists build calendars too.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    selectedIdeas: Array.isArray(body.selectedIdeas) ? body.selectedIdeas : undefined,
  });

  // Upsert the plan (regenerate in place if one exists for this month/year)
  const { data: existingPlan } = await admin
    .from("social_content_plans")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("plan_month", month)
    .eq("plan_year", year)
    .maybeSingle<Pick<SocialContentPlan, "id" | "status">>();

  const campaignTypesUsed = [...new Set(posts.map((p) => p.campaign_type))];
  const awarenessNamesUsed = posts
    .filter((p) => p.campaign_type === "awareness_day")
    .map((p) => p.campaign_label);

  let planId: number;
  let preservedCount = 0;
  let replacedCount = 0;
  // Dates already spoken for by preserved posts — new posts skip these so a day
  // never ends up with two posts.
  const preservedDates = new Set<string>();

  if (existingPlan) {
    // Work the strategist has touched is never destroyed: a post is preserved if
    // it is locked, or if it has moved past "idea" (brief sent, drafted, approved…).
    const { data: existingPosts } = await admin
      .from("social_content_posts")
      .select("id, post_date, status, locked")
      .eq("plan_id", existingPlan.id)
      .returns<Pick<SocialContentPost, "id" | "post_date" | "status" | "locked">[]>();

    const preserved = (existingPosts ?? []).filter((p) => p.locked || p.status !== "idea");
    const replaceable = (existingPosts ?? []).filter((p) => !p.locked && p.status === "idea");

    preservedCount = preserved.length;
    replacedCount = replaceable.length;
    for (const p of preserved) preservedDates.add(p.post_date);

    if (replaceable.length > 0) {
      const { error: deleteError } = await admin
        .from("social_content_posts")
        .delete()
        .in("id", replaceable.map((p) => p.id));
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Keep an advanced plan status (approved / sent_to_client) intact; only a
    // plan still in draft stays in draft.
    await admin.from("social_content_plans").update({
      campaign_types_used: campaignTypesUsed,
      awareness_days_used: awarenessNamesUsed,
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

  const postRows = posts
    .map((p, i) => ({ post: p, sortOrder: i }))
    .filter(({ post }) => !preservedDates.has(post.post_date))
    .map(({ post, sortOrder }) => ({
      plan_id: planId,
      client_id: clientId,
      post_date: post.post_date,
      platform: post.platform,
      campaign_type: post.campaign_type,
      campaign_label: post.campaign_label,
      caption_draft: post.caption_draft,
      shot_list: post.shot_list,
      hashtags: post.hashtags,
      status: "idea" as const,
      locked: false,
      sort_order: sortOrder,
    }));

  if (postRows.length > 0) {
    const { error: insertError } = await admin.from("social_content_posts").insert(postRows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

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

  return NextResponse.json({
    plan: savedPlan,
    posts: savedPosts ?? [],
    preservedCount,
    replacedCount,
  });
}
