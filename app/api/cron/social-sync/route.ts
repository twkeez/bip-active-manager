import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { runSocialSyncAll } from "@/lib/social/sync-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { watchedCronRoute } from "@/lib/job-watch/record";

/**
 * The scheduled half of social reporting.
 *
 * Social was button-only and per-client, which meant the whole roster only ever
 * refreshed if somebody clicked through it one practice at a time. It last ran
 * on 2026-07-09 and nobody noticed for two months — the same way the ads sync
 * went quiet. The freshness canary watches this job in turn.
 */

export const maxDuration = 800;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const summary = await runSocialSyncAll(createAdminClient(), startedAt);
    // Partial when any client failed or the time budget left some unreached.
    const complete = summary.failed === 0 && summary.deferred === 0;
    return NextResponse.json(
      {
        ok: complete,
        ...(summary.deferred
          ? { error: `${summary.deferred} client(s) not reached in time; they go first next run: ${summary.deferredNames.slice(0, 10).join(", ")}` }
          : {}),
        deferred: summary.deferred,
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
      { status: complete ? 200 : 207 },
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

// Every run is recorded so the job watchdog can report failures, timeouts
// and runs that never came.
// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("social-sync", handle);
export const POST = GET;
