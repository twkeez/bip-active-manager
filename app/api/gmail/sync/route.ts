import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";
import { syncInboxForUser } from "@/lib/gmail/sync";
import { scoreUnassessedEmails } from "@/lib/gmail/ai-priority";

// A sync reads every page of the window (one Gmail call per message), so give
// it the full budget; it stops starting new pages at 240s and says so.
export const maxDuration = 300;

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
      deadlineMs: Date.now() + 240_000,
    });
    // AI-score newly-synced emails (resilient — never fails the sync).
    const ai = await scoreUnassessedEmails(admin, user.id);
    // Not finished means more mail is waiting in this window: say so, and the
    // next sync picks up from the same point.
    return NextResponse.json(
      {
        ...result,
        ok: result.complete,
        error: result.complete ? undefined : "Not finished: more messages are waiting. Sync again to continue.",
        aiScored: ai.scored,
      },
      { status: result.complete ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Gmail inbox" },
      { status: 500 },
    );
  }
}
