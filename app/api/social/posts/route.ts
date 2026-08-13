import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialContentPlan, SocialContentPost } from "@/lib/social/types";

// Manual placement: a card dragged from the source rail onto a day cell.
// The plan row is created lazily — selecting a month does not create one,
// only the first drop does.

type SourceKind = "idea" | "fresh" | "awareness";

type CreateBody = {
  clientId?: number;
  month?: number;
  year?: number;
  postDate?: string;
  kind?: SourceKind;
  sourceId?: number | null;
  title?: string;
  campaignType?: string;
};

const VALID_KINDS = new Set<SourceKind>(["idea", "fresh", "awareness"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = Number(body.clientId);
  const month = Number(body.month);
  const year = Number(body.year);
  const postDate = String(body.postDate ?? "");
  const kind = body.kind;
  const title = (body.title ?? "").trim();
  const campaignType = (body.campaignType ?? "").trim();

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2020) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }
  if (!DATE_RE.test(postDate)) {
    return NextResponse.json({ error: "postDate must be YYYY-MM-DD" }, { status: 400 });
  }
  // The date has to belong to the month being edited.
  const [pYear, pMonth] = postDate.split("-").map(Number);
  if (pYear !== year || pMonth !== month) {
    return NextResponse.json({ error: "postDate is outside the selected month" }, { status: 400 });
  }
  if (!kind || !VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "kind must be idea, fresh, or awareness" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!campaignType) return NextResponse.json({ error: "campaignType required" }, { status: 400 });

  const sourceId =
    body.sourceId == null ? null : Number.isInteger(Number(body.sourceId)) ? Number(body.sourceId) : null;

  const admin = createAdminClient();

  // Find the plan for this month, or create it on this first drop.
  const { data: existingPlan, error: planLookupError } = await admin
    .from("social_content_plans")
    .select("*")
    .eq("client_id", clientId)
    .eq("plan_month", month)
    .eq("plan_year", year)
    .maybeSingle<SocialContentPlan>();
  if (planLookupError) return NextResponse.json({ error: planLookupError.message }, { status: 500 });

  let plan = existingPlan;
  let planCreated = false;
  if (!plan) {
    const { data: newPlan, error: planError } = await admin
      .from("social_content_plans")
      .insert({
        client_id: clientId,
        plan_month: month,
        plan_year: year,
        status: "draft",
        created_by: user.email,
      })
      .select("*")
      .single<SocialContentPlan>();
    if (planError || !newPlan) {
      return NextResponse.json({ error: planError?.message ?? "Failed to create plan" }, { status: 500 });
    }
    plan = newPlan;
    planCreated = true;
  }

  // Append to the end of the plan's ordering.
  const { data: lastPost } = await admin
    .from("social_content_posts")
    .select("sort_order")
    .eq("plan_id", plan.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const nextSortOrder = (lastPost?.sort_order ?? -1) + 1;

  const { data: post, error: insertError } = await admin
    .from("social_content_posts")
    .insert({
      plan_id: plan.id,
      client_id: clientId,
      post_date: postDate,
      platform: "both",
      campaign_type: campaignType,
      campaign_label: title,
      caption_draft: "",
      shot_list: "",
      hashtags: null,
      status: "idea",
      locked: false,
      sort_order: nextSortOrder,
      // Fresh ideas have no repository row, so idea_id stays null.
      idea_id: kind === "idea" ? sourceId : null,
      awareness_day_id: kind === "awareness" ? sourceId : null,
      series_id: null,
      series_part: null,
    })
    .select("*")
    .single<SocialContentPost>();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ post, plan, planCreated });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { postId?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const postId = Number(body.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // A locked post is protected from deletion as well as from regeneration.
  const { data: post } = await admin
    .from("social_content_posts")
    .select("id, locked")
    .eq("id", postId)
    .maybeSingle<Pick<SocialContentPost, "id" | "locked">>();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.locked) {
    return NextResponse.json({ error: "This post is locked. Unlock it before deleting." }, { status: 409 });
  }

  const { error } = await admin.from("social_content_posts").delete().eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
