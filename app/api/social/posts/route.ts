import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialContentPlan, SocialContentPost } from "@/lib/social/types";

// Manual placement: a card dragged from the source rail onto a day cell.
// The plan row is created lazily — selecting a month does not create one,
// only the first drop does.

type SourceKind = "idea" | "fresh" | "awareness" | "series";

/** One post to create. A series expansion sends many of these at once. */
type CreateItem = {
  postDate?: string;
  kind?: SourceKind;
  sourceId?: number | null;
  title?: string;
  campaignType?: string;
  /** Series placement only. */
  seriesId?: number | null;
  seriesPart?: number | null;
  shotList?: string | null;
};

type CreateBody = CreateItem & {
  clientId?: number;
  month?: number;
  year?: number;
  /** When present, creates every item in one request (series expansion). */
  items?: CreateItem[];
};

const VALID_KINDS = new Set<SourceKind>(["idea", "fresh", "awareness", "series"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 40; // a month can't sensibly hold more than this from one drop

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = Number(body.clientId);
  const month = Number(body.month);
  const year = Number(body.year);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2020) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }

  // One drop of an idea/day, or a whole series expansion in one request.
  const rawItems: CreateItem[] = Array.isArray(body.items) ? body.items : [body];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "nothing to create" }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: `too many posts in one request (max ${MAX_ITEMS})` }, { status: 400 });
  }

  type ResolvedItem = {
    postDate: string;
    kind: SourceKind;
    title: string;
    campaignType: string;
    sourceId: number | null;
    seriesId: number | null;
    seriesPart: number | null;
    shotList: string;
  };
  const items: ResolvedItem[] = [];

  for (const raw of rawItems) {
    const postDate = String(raw.postDate ?? "");
    const kind = raw.kind;
    const title = (raw.title ?? "").trim();
    const campaignType = (raw.campaignType ?? "").trim();

    if (!DATE_RE.test(postDate)) {
      return NextResponse.json({ error: "postDate must be YYYY-MM-DD" }, { status: 400 });
    }
    // Every date has to belong to the month being edited — expansions are
    // clipped client-side, and this is the backstop.
    const [pYear, pMonth] = postDate.split("-").map(Number);
    if (pYear !== year || pMonth !== month) {
      return NextResponse.json({ error: "postDate is outside the selected month" }, { status: 400 });
    }
    if (!kind || !VALID_KINDS.has(kind)) {
      return NextResponse.json({ error: "kind must be idea, fresh, awareness, or series" }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!campaignType) return NextResponse.json({ error: "campaignType required" }, { status: 400 });

    const seriesPart =
      raw.seriesPart == null ? null : Number.isInteger(Number(raw.seriesPart)) ? Number(raw.seriesPart) : null;

    items.push({
      postDate,
      kind,
      title,
      campaignType,
      sourceId: raw.sourceId == null ? null : Number.isInteger(Number(raw.sourceId)) ? Number(raw.sourceId) : null,
      seriesId: raw.seriesId == null ? null : Number.isInteger(Number(raw.seriesId)) ? Number(raw.seriesId) : null,
      seriesPart,
      shotList: typeof raw.shotList === "string" ? raw.shotList : "",
    });
  }

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

  const rows = items.map((item, i) => ({
    plan_id: plan.id,
    client_id: clientId,
    post_date: item.postDate,
    platform: "both" as const,
    campaign_type: item.campaignType,
    campaign_label: item.title,
    caption_draft: "",
    // An arc part can seed its shot list from the part's suggested_shot.
    shot_list: item.shotList,
    hashtags: null,
    status: "idea" as const,
    locked: false,
    sort_order: nextSortOrder + i,
    // Fresh ideas have no repository row, so idea_id stays null.
    idea_id: item.kind === "idea" ? item.sourceId : null,
    awareness_day_id: item.kind === "awareness" ? item.sourceId : null,
    series_id: item.kind === "series" ? item.seriesId : null,
    series_part: item.kind === "series" ? item.seriesPart : null,
  }));

  const { data: posts, error: insertError } = await admin
    .from("social_content_posts")
    .insert(rows)
    .select("*")
    .returns<SocialContentPost[]>();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // `post` keeps the single-drop shape working; `posts` carries expansions.
  return NextResponse.json({ post: posts?.[0] ?? null, posts: posts ?? [], plan, planCreated });
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

  const { data: post } = await admin
    .from("social_content_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle<Pick<SocialContentPost, "id">>();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const { error } = await admin.from("social_content_posts").delete().eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
