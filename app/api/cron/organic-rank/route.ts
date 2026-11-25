import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { runMonthlyOrganicScan } from "@/lib/organic-rank/monthly";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Monthly organic rankings refresh, run hourly on the morning of the 1st
 * (vercel.json). The first run scans every due client it can in its time;
 * later runs that morning pick up the rest and do nothing once all are done.
 * See lib/organic-rank/monthly.ts for what is scanned and what it costs.
 */

export const maxDuration = 800;
/** Stop starting new clients after this, leaving room for the last one to finish. */
const BUDGET_MS = 600_000;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized", configured: cronSecretConfigured() }, { status: 401 });
  }
  try {
    const summary = await runMonthlyOrganicScan(createAdminClient(), { startedAt: Date.now(), budgetMs: BUDGET_MS });
    const failed = summary.failed.length;
    return NextResponse.json(
      {
        ok: failed === 0,
        ...summary,
        ...(failed
          ? { error: summary.failed.map((f) => `${f.client}: ${f.error}`).join("; ").slice(0, 1000) }
          : {}),
      },
      { status: failed === 0 ? 200 : summary.scanned > 0 ? 207 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "The rankings refresh failed." },
      { status: 500 },
    );
  }
}

// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("organic-rank", handle);
export const POST = GET;
