import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { runJobWatch } from "@/lib/job-watch/run-watch";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The hourly job watchdog: emails Tom about any scheduled job that failed,
 * partly failed, timed out or did not run, plus one summary each morning. It
 * also sweeps strategist follow-ups: closing answered ones, reminding once.
 * It records its own runs too, and the morning email is the check on it:
 * if that stops arriving, the watchdog has stopped.
 */

export const maxDuration = 60;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }
  try {
    const result = await runJobWatch(createAdminClient());
    // 207 when the follow-up sweep hit trouble: recorded as a partial run, so
    // the next hourly check emails Tom about it.
    const partial = result.followupErrors.length > 0;
    return NextResponse.json(
      { ok: !partial, ...result, ...(partial ? { error: result.followupErrors.join(" ") } : {}) },
      { status: partial ? 207 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Job watch failed" },
      { status: 500 },
    );
  }
}

// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("job-watch", handle);
export const POST = GET;
