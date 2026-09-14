import { NextResponse } from "next/server";
import { runAdsSyncAll } from "@/lib/ads/sync-all";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The scheduled half of ads reporting.
 *
 * Google retired the API version this app called in July 2026 and the stored
 * connection lost its adwords scope at the same time. Nothing noticed for two
 * months, because ads only refreshed when somebody pressed "Sync all" — so the
 * numbers on every client page stayed confidently wrong instead of going
 * visibly stale. This job removes the human from that loop, and the ads
 * freshness canary watches this job in turn.
 *
 * A partial run is still worth keeping: per-account failures are reported but
 * do not fail the request, because one revoked customer ID should not discard
 * 37 good refreshes. The response is 207 when any account failed, so the
 * workflow can warn without turning the schedule red.
 */

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    // `configured` says whether the server has a secret at all, without saying
    // what it is — a 401 otherwise cannot distinguish "the variable never
    // reached this deployment" from "the caller sent the wrong value".
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const summary = await runAdsSyncAll(createAdminClient());
    return NextResponse.json(
      {
        ok: summary.failed === 0,
        ...summary,
        // Only the failures are worth reading in a workflow log; the successes
        // are visible in the app.
        results: summary.results.filter((result) => result.status === "failed"),
        ms: Date.now() - startedAt,
      },
      { status: summary.failed === 0 ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ads sync failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
