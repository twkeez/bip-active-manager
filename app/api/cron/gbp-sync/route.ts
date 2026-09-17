import { NextResponse } from "next/server";
import { runGbpSyncAll } from "@/lib/sync/nightly";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Business Profile sync, nightly.
 *
 * The Google listing and its reviews: rating, review count and the reviews
 * themselves. Reviews arrive without warning and are the one thing a practice
 * expects us to notice, so they cannot wait for somebody to press a button.
 *
 * Per-client failures are reported but do not fail the request: one client with
 * a revoked property should not discard the rest of the roster. 207 says some
 * failed, so the workflow can warn without turning the schedule red.
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
    const summary = await runGbpSyncAll(createAdminClient(), startedAt);
    return NextResponse.json(
      {
        ok: summary.failed === 0,
        ...summary,
        // Failures need fixing tonight; blocked accounts need a person, and
        // both are worth reading in the log. Successes are visible in the app.
        results: summary.results.filter((result) => result.status !== "ok"),
        ms: Date.now() - startedAt,
      },
      { status: summary.failed === 0 ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Business Profile sync failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
