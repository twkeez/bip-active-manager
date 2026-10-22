import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { categorizeTickets } from "@/lib/help-desk/categorize";
import { buildHelpDeskReport } from "@/lib/help-desk/run";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { syncZendesk } from "@/lib/zendesk/sync";

/**
 * The Help Desk Report, refreshed every Monday morning without anyone pressing
 * "Run everything": pull the week's Zendesk changes, sort the new tickets,
 * write the sheet.
 *
 * A week of tickets fits easily in one run. If Zendesk is slow or rate-limits
 * us, the sheet is still written from what was pulled, and the response is
 * 207 so the job watchdog flags a partial run; the saved cursor means the next
 * run (or a press of the button) picks up exactly where this one stopped.
 */

export const maxDuration = 800;

/** Time for each stage, from the start of the run, leaving the rest for the sheet. */
const ZENDESK_BUDGET_MS = 300_000;
const CATEGORIZE_BUDGET_MS = 600_000;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized", configured: cronSecretConfigured() },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  try {
    const zendesk = await syncZendesk(startedAt + ZENDESK_BUDGET_MS);
    const categorize = await categorizeTickets(startedAt + CATEGORIZE_BUDGET_MS);
    const report = await buildHelpDeskReport("Weekly schedule");
    const complete = zendesk.done && categorize.done;
    return NextResponse.json(
      {
        ok: complete,
        zendesk: { done: zendesk.done, counts: zendesk.counts },
        categorize,
        sheetUrl: report.sheetUrl,
        summary: report.summary,
        ms: Date.now() - startedAt,
      },
      { status: complete ? 200 : 207 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Help desk report failed",
        ms: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// Every run is recorded so the job watchdog can report failures, timeouts
// and runs that never came. Vercel Cron calls with GET; POST is for manual runs.
export const GET = watchedCronRoute("help-desk-report", handle);
export const POST = GET;
