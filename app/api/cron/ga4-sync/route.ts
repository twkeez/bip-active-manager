import { nightlyOutcome } from "@/lib/sync/nightly-response";
import { NextResponse } from "next/server";
import { runGa4SyncAll } from "@/lib/sync/nightly";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";
import { watchedCronRoute } from "@/lib/job-watch/record";

/**
 * GA4 sync, nightly.
 *
 * Sessions, conversions and channel mix for every client with a GA4 property.
 * The stored figures were two months old when this job was added, because
 * nothing refreshed them but a button.
 *
 * Per-client failures are reported but do not fail the request: one client with
 * a revoked property should not discard the rest of the roster. 207 says some
 * failed, so the workflow can warn without turning the schedule red.
 */

export const maxDuration = 300;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const summary = await runGa4SyncAll(createAdminClient(), startedAt);
    const outcome = nightlyOutcome(summary);
    return NextResponse.json(
      {
        ok: outcome.complete,
        ...summary,
        ...(outcome.summaryText ? { error: outcome.summaryText } : {}),
        // Failures need fixing tonight; blocked accounts need a person, and
        // both are worth reading in the log. Successes are visible in the app.
        results: summary.results.filter((result) => result.status !== "ok"),
        ms: Date.now() - startedAt,
      },
      { status: outcome.complete ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "GA4 sync failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Every run is recorded so the job watchdog can report failures, timeouts
// and runs that never came.
// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("ga4-sync", handle);
export const POST = GET;
