import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { runClientWatchRefresh } from "@/lib/client-watch/run";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The Client Watch refresh, weekday mornings after the Basecamp sync
 * (vercel.json). Reads only clients with new Basecamp posts since their last
 * read, plus any never read or whose last read failed; a second run later in
 * the morning picks up anything the first ran out of time for.
 * See lib/client-watch for what a read is and what it costs.
 */

export const maxDuration = 800;
/** Stop starting new reads after this, leaving room for the ones under way to finish. */
const BUDGET_MS = 600_000;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized", configured: cronSecretConfigured() }, { status: 401 });
  }
  try {
    const summary = await runClientWatchRefresh(createAdminClient(), { startedAt: Date.now(), budgetMs: BUDGET_MS });
    const failed = summary.failed.length;
    return NextResponse.json(
      {
        ok: failed === 0,
        ...summary,
        ...(failed ? { error: summary.failed.map((f) => `${f.client}: ${f.error}`).join("; ").slice(0, 1000) } : {}),
      },
      { status: failed === 0 ? 200 : summary.read > 0 ? 207 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "The Client Watch refresh failed." },
      { status: 500 },
    );
  }
}

// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("client-watch", handle);
export const POST = GET;
