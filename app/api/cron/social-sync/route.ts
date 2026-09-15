import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { runSocialSyncAll } from "@/lib/social/sync-all";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The scheduled half of social reporting.
 *
 * Social was button-only and per-client, which meant the whole roster only ever
 * refreshed if somebody clicked through it one practice at a time. It last ran
 * on 2026-07-09 and nobody noticed for two months — the same way the ads sync
 * went quiet. The freshness canary watches this job in turn.
 */

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const summary = await runSocialSyncAll(createAdminClient());
    return NextResponse.json(
      {
        ok: summary.failed === 0,
        synced: summary.synced,
        failed: summary.failed,
        skipped: summary.skipped,
        warned: summary.warned,
        // Only the problems are worth a workflow log; successes show in the app.
        results: summary.results.filter(
          (result) => result.status === "failed" || result.warnings?.length,
        ),
        ms: Date.now() - startedAt,
      },
      { status: summary.failed === 0 ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Social sync failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
