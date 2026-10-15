import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { categorizeTickets } from "@/lib/help-desk/categorize";
import { buildHelpDeskReport } from "@/lib/help-desk/run";
import { createClient } from "@/lib/supabase/server";
import { syncZendesk } from "@/lib/zendesk/sync";

/**
 * The help desk report, one step per request so each fits the function's time
 * limit: "zendesk" (copy tickets in), "categorize" (sort them with Claude),
 * "report" (match and write the Google Sheet). The first two answer
 * `done: false` while there is more to do; the page calls again until done.
 */

export const maxDuration = 300;

/** Stop starting new work this long before the limit, so the cursor is saved. */
const BUDGET_MS = 240_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { step?: string };
  const deadline = Date.now() + BUDGET_MS;

  try {
    switch (body.step) {
      case "zendesk":
        return NextResponse.json(await syncZendesk(deadline));
      case "categorize":
        return NextResponse.json(await categorizeTickets(deadline));
      case "report":
        return NextResponse.json({ done: true, ...(await buildHelpDeskReport(profile.email ?? null)) });
      default:
        return NextResponse.json({ error: "step must be zendesk, categorize or report" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[help-desk] ${body.step} failed:`, error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
