import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";
import { syncInboxForUser } from "@/lib/gmail/sync";
import { scoreUnassessedEmails } from "@/lib/gmail/ai-priority";

// A "full" pull can fetch a few hundred messages (one Gmail call each), so give
// the function more headroom than the default.
export const maxDuration = 120;

type SyncBody = {
  full?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  try {
    const admin = createAdminClient();
    const token = await getGmailAccessTokenForUser(admin, user.id);
    const result = await syncInboxForUser({
      admin,
      userId: user.id,
      accessToken: token.accessToken,
      full: body.full === true,
      maxMessages: body.full === true ? 300 : 100,
    });
    // AI-score newly-synced emails (resilient — never fails the sync).
    const ai = await scoreUnassessedEmails(admin, user.id);
    return NextResponse.json({ ok: true, ...result, aiScored: ai.scored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Gmail inbox" },
      { status: 500 },
    );
  }
}
