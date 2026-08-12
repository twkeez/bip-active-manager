import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SocialContentPost } from "@/lib/social/types";

// Open to all authenticated team members — strategists edit their calendars.
export async function PUT(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
