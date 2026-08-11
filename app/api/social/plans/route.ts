import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialContentPlan, SocialContentPost } from "@/lib/social/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: plans, error } = await admin
    .from("social_content_plans")
    .select("*")
    .eq("client_id", Number(clientId))
    .order("plan_year", { ascending: false })
    .order("plan_month", { ascending: false })
    .returns<SocialContentPlan[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!plans || plans.length === 0) return NextResponse.json([]);

  const planIds = plans.map((p) => p.id);
  const { data: posts, error: postsError } = await admin
    .from("social_content_posts")
    .select("*")
    .in("plan_id", planIds)
    .order("sort_order")
    .order("post_date")
    .returns<SocialContentPost[]>();

  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 });

  const postsByPlan = (posts ?? []).reduce<Record<number, SocialContentPost[]>>((acc, post) => {
    (acc[post.plan_id] ??= []).push(post);
    return acc;
  }, {});

  return NextResponse.json(plans.map((p) => ({ ...p, posts: postsByPlan[p.id] ?? [] })));
}
