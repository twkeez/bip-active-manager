import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialIdea, SocialPostSnapshot, SocialSignal } from "@/lib/types/client";

type IdeasRequestBody = {
  clientId?: number;
};

function buildIdeas(posts: SocialPostSnapshot[], signals: SocialSignal[]): SocialIdea[] {
  const topPosts = [...posts]
    .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
    .slice(0, 3);
  const lowSignal = signals.find((signal) =>
    ["low_engagement_rate_week", "reach_drop_week_over_week"].includes(signal.signal_id),
  );

  const topBasedIdeas = topPosts.map((post, index) => {
    const caption = (post.caption ?? "").replace(/\s+/g, " ").trim();
    const snippet = caption ? caption.slice(0, 90) : "a recent high-performing post";
    return {
      id: `top-${post.platform}-${post.post_id}-${index}`,
      theme: `Repeat what worked on ${post.platform}`,
      objective: "Increase reach and engagement on a proven content pattern.",
      hook: `Use the winning angle from "${snippet}" with a fresh opening sentence.`,
      format:
        post.media_type?.toLowerCase().includes("video") || post.media_type === "REEL"
          ? "Short-form video / reel"
          : "Image + caption carousel",
      cta: "Invite one specific comment action (opinion, vote, quick answer).",
      suggested_window: "Tue-Thu 9am-1pm local time",
    };
  });

  const recoveryIdea: SocialIdea[] = lowSignal
    ? [
        {
          id: `recovery-${lowSignal.signal_id}`,
          theme: "Recover declining reach",
          objective: "Counter recent week-over-week decline with a tighter publishing sequence.",
          hook: "Launch a 3-post mini-series around one high-intent topic this week.",
          format: "1 reel + 1 static post + 1 carousel",
          cta: "Drive saves/shares with a checklist or template angle.",
          suggested_window: "Next 7 days, spaced every 48 hours",
        },
      ]
    : [];

  const cadenceIdea: SocialIdea = {
    id: "cadence-balance",
    theme: "Content cadence balance",
    objective: "Maintain consistency while testing new topics.",
    hook: "Use a weekly mix: educational, social proof, and promotional.",
    format: "3-post weekly cadence",
    cta: "End each post with one clear micro-action.",
    suggested_window: "Mon/Wed/Fri mornings",
  };

  return [...topBasedIdeas, ...recoveryIdea, cadenceIdea].slice(0, 6);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IdeasRequestBody;
  try {
    body = (await request.json()) as IdeasRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [postsResult, signalsResult] = await Promise.all([
    admin
      .from("client_social_post_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("published_at", { ascending: false })
      .limit(50)
      .returns<SocialPostSnapshot[]>(),
    admin
      .from("client_social_signals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .returns<SocialSignal[]>(),
  ]);

  if (postsResult.error || signalsResult.error) {
    return NextResponse.json(
      {
        error:
          postsResult.error?.message ??
          signalsResult.error?.message ??
          "Failed to load social context for ideas",
      },
      { status: 500 },
    );
  }

  const ideas = buildIdeas(postsResult.data ?? [], signalsResult.data ?? []);
  return NextResponse.json({ ok: true, ideas: ideas as SocialIdea[] });
}
