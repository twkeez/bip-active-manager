import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";
import { exportBlockedMessage } from "@/components/data-integrity/export-blocked";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { generateClaudeText } from "@/lib/ai/claude";
import { rejectUnlessClientVisible } from "@/lib/reporting/client-access";
import { loadReportForClient } from "@/lib/reporting/load-report";
import { buildSummaryPrompt, parseSummaryAnswer } from "@/lib/reporting/summary-prompt";

type Params = Promise<{ clientId: string }>;

/**
 * Drafts a summary and next steps with AI from the client's report as the
 * server builds it. Saves nothing: the text goes back to the editor as a draft,
 * and only a strategist's Save and approve lets it reach the client.
 */
export async function POST(req: Request, context: { params: Params }) {
  const { clientId } = await context.params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const { supabase, profile } = auth;

  const denied = await rejectUnlessClientVisible(supabase, id);
  if (denied) return denied;

  const range = new URL(req.url).searchParams.get("range") ?? "last30";
  const { result: loaded, truncated } = await withIntegrityScope(() =>
    loadReportForClient(supabase, profile.id, id, range),
  );
  if (!loaded) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  // Never let the AI write from numbers built on a read the database cut short.
  if (truncated.length) {
    return NextResponse.json({ error: exportBlockedMessage("summary", truncated) }, { status: 409 });
  }

  try {
    const answer = await generateClaudeText(buildSummaryPrompt(loaded.report));
    return NextResponse.json(parseSummaryAnswer(answer));
  } catch (error) {
    return NextResponse.json(
      { error: `The AI draft failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
