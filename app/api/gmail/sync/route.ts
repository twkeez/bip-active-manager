import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";
import { syncInboxPageForUser } from "@/lib/gmail/sync";

type SyncBody = {
  pageToken?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const result = await syncInboxPageForUser({
      admin,
      userId: user.id,
      accessToken: token.accessToken,
      pageToken: body.pageToken,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Gmail inbox" },
      { status: 500 },
    );
  }
}
