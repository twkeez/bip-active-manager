import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBasecampOAuthConfig } from "@/lib/env";
import { markBasecampSyncError, runBasecampSync } from "@/lib/basecamp/sync";
import { runThreadClassification } from "@/lib/coal-mines/run-thread-classification";

/**
 * The scheduled half of the Basecamp canary.
 *
 * Everything here also exists as a button, and buttons only fire when somebody
 * remembers. A thread the client reopened on Friday is not a finding until
 * something re-reads it, so without this the canary reports whenever it was
 * last clicked rather than what is true now.
 *
 * Two steps in order, because the second depends on the first: sync pulls the
 * current state of every watched thread, then classification reads whatever
 * moved. Classification is keyed on the excerpt changing, so a quiet period
 * costs one Basecamp sync and no Claude call at all.
 *
 * There is no user here, so it authenticates with a shared secret rather than a
 * session.
 */

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Refuse rather than run open when the secret is unset — an unauthenticated
  // endpoint that spends money is worse than one that does not work.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (presented.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(presented), Buffer.from(secret));
}

/** OAuth when it is configured, Basecamp 2 otherwise — same rule as the button. */
function resolveMode(): "oauth" | "classic" {
  try {
    getBasecampOAuthConfig();
    return "oauth";
  } catch {
    return "classic";
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result: Record<string, unknown> = { ok: true };

  // Sync first; a classification run over stale rows would read messages that
  // are no longer the latest, which is the failure this whole job exists to fix.
  try {
    const sync = await runBasecampSync(resolveMode());
    result.sync = sync;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Basecamp sync failed";
    try {
      await markBasecampSyncError(message);
    } catch {
      // Secondary logging failure must not mask the real error.
    }
    // Deliberately stop: classifying against a failed sync would write verdicts
    // about messages we know to be out of date.
    return NextResponse.json(
      { ok: false, step: "sync", error: message, ms: Date.now() - startedAt },
      { status: 500 },
    );
  }

  try {
    result.classification = await runThreadClassification(createAdminClient());
  } catch (e) {
    // The sync succeeded, so the canary is already more current than it was.
    // Report the partial success rather than throwing all of it away.
    result.ok = false;
    result.classificationError = e instanceof Error ? e.message : "Classification failed";
  }

  result.ms = Date.now() - startedAt;
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
