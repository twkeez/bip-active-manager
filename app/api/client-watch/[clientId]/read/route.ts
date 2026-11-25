import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/profile";
import { runClientWatchRefresh } from "@/lib/client-watch/run";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-read one client for Client Watch now, whether or not its Basecamp has
 * changed. Admins only, like the page. One Claude request; the cost is
 * recorded under "Client Watch" on AI Spend.
 */

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.profile)) return NextResponse.json({ error: "Client Watch is for admins." }, { status: 403 });
  const clientId = Number((await context.params).clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });

  try {
    const summary = await runClientWatchRefresh(createAdminClient(), { budgetMs: 240_000, onlyClientId: clientId });
    const failure = summary.failed[0];
    if (failure) return NextResponse.json({ error: failure.error }, { status: 502 });
    return NextResponse.json({ ok: true, costUsd: summary.costUsd });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't re-read this client." }, { status: 500 });
  }
}
