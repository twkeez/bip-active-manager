import { NextResponse } from "next/server";
import { runAdsSyncAll } from "@/lib/ads/sync-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The "Sync all" button. The same work runs nightly at /api/cron/ads-sync. */
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runAdsSyncAll(createAdminClient()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ads sync failed" },
      { status: 500 },
    );
  }
}
