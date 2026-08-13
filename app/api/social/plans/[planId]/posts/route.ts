import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostStatus, SocialContentPost } from "@/lib/social/types";

// Only these columns may be written from the client. Anything else is rejected
// rather than silently ignored, so a typo surfaces instead of losing an edit.
const EDITABLE_FIELDS = [
  "caption_draft",
  "shot_list",
  "hashtags",
  "status",
  "locked",
  "sort_order",
  "post_date",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const VALID_STATUSES = new Set<PostStatus>([
  "idea",
  "brief_sent",
  "asset_received",
  "drafted",
  "approved",
  "scheduled",
  "posted",
]);

// Open to all authenticated team members — strategists edit their calendars.
export async function PUT(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  let body: { postId?: number; updates?: Record<string, unknown> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const postId = Number(body.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const rawUpdates = body.updates;
  if (!rawUpdates || typeof rawUpdates !== "object" || Array.isArray(rawUpdates)) {
    return NextResponse.json({ error: "updates object required" }, { status: 400 });
  }

  const unknownKeys = Object.keys(rawUpdates).filter(
    (key) => !EDITABLE_FIELDS.includes(key as EditableField),
  );
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unsupported field(s): ${unknownKeys.join(", ")}. Allowed: ${EDITABLE_FIELDS.join(", ")}` },
      { status: 400 },
    );
  }

  // Type-check each supplied value before it reaches the database.
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(rawUpdates) as EditableField[]) {
    const value = rawUpdates[key];
    switch (key) {
      case "caption_draft":
      case "shot_list":
      case "hashtags":
        if (value !== null && typeof value !== "string") {
          return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 });
        }
        break;
      case "status":
        if (typeof value !== "string" || !VALID_STATUSES.has(value as PostStatus)) {
          return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
        }
        break;
      case "locked":
        if (typeof value !== "boolean") {
          return NextResponse.json({ error: "locked must be a boolean" }, { status: 400 });
        }
        break;
      case "sort_order":
        if (!Number.isInteger(value)) {
          return NextResponse.json({ error: "sort_order must be an integer" }, { status: 400 });
        }
        break;
      case "post_date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return NextResponse.json({ error: "post_date must be YYYY-MM-DD" }, { status: 400 });
        }
        break;
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_content_posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("plan_id", Number(planId))
    .select("*")
    .single<SocialContentPost>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
