import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { draftSocialPosts } from "@/lib/wins/draft";
import type { SocialPlatform, WinDraftInput } from "@/lib/wins/types";

export const maxDuration = 90;

const VALID_PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram"];

type Body = {
  wins?: WinDraftInput[];
  platforms?: SocialPlatform[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wins = (body.wins ?? []).filter((w) => w?.win?.context);
  const platforms = (body.platforms ?? []).filter((p) => VALID_PLATFORMS.includes(p));
  if (!wins.length) {
    return NextResponse.json({ error: "Select at least one win." }, { status: 400 });
  }
  if (!platforms.length) {
    return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
  }

  try {
    const posts = await draftSocialPosts({ wins: wins.slice(0, 12), platforms });
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to draft posts" },
      { status: 500 },
    );
  }
}
