import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import type { SocialContentPost } from "@/lib/social/types";

export async function PUT(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { planId } = await params;
  let body: { postId: number; updates: Partial<SocialContentPost> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_content_posts")
    .update({ ...body.updates, updated_at: new Date().toISOString() })
    .eq("id", body.postId)
    .eq("plan_id", Number(planId))
    .select("*")
    .single<SocialContentPost>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
