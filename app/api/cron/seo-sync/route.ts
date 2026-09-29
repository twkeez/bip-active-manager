import { nightlyOutcome } from "@/lib/sync/nightly-response";
import { NextResponse } from "next/server";
import { runSearchConsoleSyncAll } from "@/lib/sync/nightly";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";
import { watchedCronRoute } from "@/lib/job-watch/record";

/**
 * Search Console sync, nightly.
 *
 * Clicks, impressions, positions and sitemap status for every client with a
 * property. Before this existed the data refreshed only when somebody opened
 * a client and pressed sync, so the SEO screens showed whatever the last
 * visitor happened to fetch.
 *
 * Per-client failures are reported but do not fail the request: one client with
 * a revoked property should not discard the rest of the roster. 207 says some
 * failed, so the workflow can warn without turning the schedule red.
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
    const summary = await runSearchConsoleSyncAll(createAdminClient(), startedAt);
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
        error: error instanceof Error ? error.message : "Search Console sync failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Every run is recorded so the job watchdog can report failures, timeouts
// and runs that never came.
// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("seo-sync", handle);
export const POST = GET;
