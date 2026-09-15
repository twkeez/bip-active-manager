import { NextResponse } from "next/server";
import { SocialSyncError, syncClientSocial } from "@/lib/social/sync-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The per-client Sync button. The same work runs nightly at /api/cron/social-sync. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { clientId?: number };
  try {
    body = (await request.json()) as { clientId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  try {
    const result = await syncClientSocial(createAdminClient(), clientId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SocialSyncError) {
      return NextResponse.json(
        { error: error.message, ...(error.extra ?? {}) },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Social sync crashed: ${error.message}`
            : "Social sync crashed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
