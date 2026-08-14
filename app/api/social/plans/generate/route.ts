import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientDisplayName } from "@/lib/clients/display-name";
import { draftPosts, type DraftRequestPost } from "@/lib/social/post-writer";
import type {
  SocialAwarenessDay,
  SocialClientProfile,
  SocialContentPlan,
  SocialContentPost,
  SocialIdea,
  StandingCampaign,
} from "@/lib/social/types";

export const maxDuration = 300;

// Fills in copy for posts a strategist has already placed on the calendar.
// This route never creates, deletes, moves, or re-topics a post — placement is
// manual. It only writes caption_draft and shot_list.

type GenerateBody = {
  planId?: number;
  /** When present, write for exactly these posts regardless of whether their
   *  caption is already filled (backs a per-post "rewrite" action). */
  postIds?: number[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: GenerateBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const planId = Number(body.planId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }
  const requestedIds = Array.isArray(body.postIds)
    ? body.postIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : null;

  const admin = createAdminClient();

  const { data: plan, error: planError } = await admin
    .from("social_content_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle<SocialContentPlan>();
  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const { data: allPosts, error: postsError } = await admin
    .from("social_content_posts")
    .select("*")
    .eq("plan_id", planId)
    .order("post_date")
    .returns<SocialContentPost[]>();
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 });

  const posts = allPosts ?? [];
  const isEmpty = (v: string | null) => !v || v.trim() === "";

  // Without an explicit selection, only fill posts that are actually missing
  // sheet copy — never silently rewrite something a strategist has written.
  const candidates = posts.filter((p) => {
    if (requestedIds) return requestedIds.includes(p.id);
    return isEmpty(p.headline) || isEmpty(p.subheadline) || isEmpty(p.photo_suggestion);
  });

  if (candidates.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0 });
  }

  // Context: practice, profile, and a concept line per post.
  const [clientRes, profileRes] = await Promise.all([
    admin
      .from("clients")
      .select("account_name, public_name, website")
      .eq("id", plan.client_id)
      .maybeSingle<{ account_name: string; public_name: string | null; website: string | null }>(),
    admin
      .from("social_client_profiles")
      .select("*")
      .eq("client_id", plan.client_id)
      .maybeSingle<SocialClientProfile>(),
  ]);
  if (!clientRes.data) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Resolve each post's concept from its provenance link, falling back to the label.
  const ideaIds = [...new Set(candidates.map((p) => p.idea_id).filter((id): id is number => id != null))];
  const awarenessIds = [...new Set(candidates.map((p) => p.awareness_day_id).filter((id): id is number => id != null))];

  const [ideasRes, awarenessRes] = await Promise.all([
    ideaIds.length
      ? admin.from("social_idea_repository").select("id, description").in("id", ideaIds).returns<Pick<SocialIdea, "id" | "description">[]>()
      : Promise.resolve({ data: [] as Pick<SocialIdea, "id" | "description">[] }),
    awarenessIds.length
      ? admin.from("social_awareness_days").select("id, content_angle").in("id", awarenessIds).returns<Pick<SocialAwarenessDay, "id" | "content_angle">[]>()
      : Promise.resolve({ data: [] as Pick<SocialAwarenessDay, "id" | "content_angle">[] }),
  ]);

  const ideaById = new Map((ideasRes.data ?? []).map((i) => [i.id, i.description]));
  const awarenessById = new Map((awarenessRes.data ?? []).map((a) => [a.id, a.content_angle]));

  const requestPosts: DraftRequestPost[] = candidates.map((p) => ({
    id: p.id,
    post_date: p.post_date,
    campaign_label: p.campaign_label,
    content_pillar: p.content_pillar,
    description:
      (p.idea_id != null ? ideaById.get(p.idea_id) : undefined) ??
      (p.awareness_day_id != null ? awarenessById.get(p.awareness_day_id) : undefined) ??
      p.campaign_label,
  }));

  let written;
  try {
    written = await draftPosts({
      apiKey,
      // Client-facing name — account_name may carry an internal group prefix.
      clientName: getClientDisplayName(clientRes.data),
      website: clientRes.data.website,
      specialty: profileRes.data?.specialty ?? null,
      tone: profileRes.data?.tone ?? null,
      notes: profileRes.data?.notes ?? null,
      standingCampaigns: (profileRes.data?.standing_campaigns as StandingCampaign[]) ?? [],
      posts: requestPosts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Draft generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Only write back to posts we actually asked about, scoped by id AND plan_id.
  const candidateIds = new Set(candidates.map((p) => p.id));
  let updated = 0;
  for (const entry of written) {
    if (!candidateIds.has(entry.post_id)) continue;
    if (!entry.headline?.trim()) continue;
    const { error } = await admin
      .from("social_content_posts")
      .update({
        content_pillar: entry.content_pillar,
        headline: entry.headline,
        subheadline: entry.subheadline,
        photo_suggestion: entry.photo_suggestion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.post_id)
      .eq("plan_id", planId);
    if (!error) updated += 1;
  }

  // Anything we asked about that came back empty or missing.
  const skipped = candidates.length - updated;

  return NextResponse.json({ updated, skipped });
}
