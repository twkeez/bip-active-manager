import { NextResponse } from "next/server";
import { runDueRoutines } from "@/lib/routines/run";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { createAdminClient } from "@/lib/supabase/admin";
import { watchedCronRoute } from "@/lib/job-watch/record";

/**
 * The hourly wake-up for routines.
 *
 * It does not know about any one routine. It asks each enabled routine whether
 * a scheduled time has passed that it has not run for, and runs those. So a
 * wake-up GitHub delivers late still runs the morning's review, and one it
 * drops is caught by the next.
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
    const summary = await runDueRoutines(createAdminClient());
    const failed = summary.runs.filter((run) => run.status === "error").length;
    return NextResponse.json(
      { ok: failed === 0, ...summary, ms: Date.now() - startedAt },
      { status: failed === 0 ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Routines failed", ms: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

// Every run is recorded so the job watchdog can report failures, timeouts
// and runs that never came.
// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("routines", handle);
export const POST = GET;
