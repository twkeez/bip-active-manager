import { NextResponse } from "next/server";
import { loadTracker, runTracker } from "@/lib/maps-rank/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuditAdmin } from "@/lib/website-audit/access";

export const maxDuration = 300;

/** Runs a tracker's searches now. Each run is live Google Maps searches, paid per search. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Unknown tracker." }, { status: 404 });
  try {
    const admin = createAdminClient();
    const tracker = await loadTracker(admin, id);
    if (!tracker) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
    const run = await runTracker(admin, tracker);
    if (run.status === "failed") return NextResponse.json({ error: `The scan failed: ${run.error ?? "no searches could be read."}`, run: { id: run.id, status: run.status } }, { status: 502 });
    return NextResponse.json({ run: { id: run.id, status: run.status, error: run.error, cost_usd: run.cost_usd } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The scan failed." }, { status: 500 });
  }
}
