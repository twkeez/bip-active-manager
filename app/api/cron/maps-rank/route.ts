import { NextResponse } from "next/server";
import { cronSecretConfigured, isAuthorizedCronRequest } from "@/lib/cron/authorize";
import { watchedCronRoute } from "@/lib/job-watch/record";
import { runTracker } from "@/lib/maps-rank/store";
import type { MapsRankTrackerRow } from "@/lib/maps-rank/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Maps rank tracker, checked daily: runs every active tracker whose last run
 * is at least its interval (two weeks by default) old. A scan is about two
 * minutes, so one call runs at most MAX_PER_CALL trackers and says how many it
 * left for tomorrow.
 */

export const maxDuration = 800;
const MAX_PER_CALL = 4;
/** A run counts as due a few hours early, so the day of the week doesn't drift later each time. */
const SLACK_HOURS = 6;

async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized", configured: cronSecretConfigured() }, { status: 401 });
  const admin = createAdminClient();
  const { data: trackers, error } = await admin.from("maps_rank_trackers").select("*").eq("active", true).order("id");
  if (error) return NextResponse.json({ ok: false, error: `Couldn't load the trackers: ${error.message}` }, { status: 500 });

  const due: MapsRankTrackerRow[] = [];
  for (const tracker of (trackers ?? []) as MapsRankTrackerRow[]) {
    const { data: last, error: lastError } = await admin.from("maps_rank_runs").select("ran_at").eq("tracker_id", tracker.id).neq("status", "failed").order("ran_at", { ascending: false }).limit(1);
    if (lastError) return NextResponse.json({ ok: false, error: `Couldn't read the last run of ${tracker.practice_name}: ${lastError.message}` }, { status: 500 });
    const lastAt = last?.[0]?.ran_at ? new Date(last[0].ran_at as string).getTime() : 0;
    if (Date.now() - lastAt >= (tracker.every_days * 24 - SLACK_HOURS) * 3_600_000) due.push(tracker);
  }

  const results: { practice: string; status: string; error: string | null }[] = [];
  for (const tracker of due.slice(0, MAX_PER_CALL)) {
    try {
      const run = await runTracker(admin, tracker);
      results.push({ practice: tracker.practice_name, status: run.status, error: run.error });
    } catch (e) {
      results.push({ practice: tracker.practice_name, status: "failed", error: e instanceof Error ? e.message : "The scan failed." });
    }
  }
  const leftForLater = Math.max(0, due.length - MAX_PER_CALL);
  const bad = results.filter((r) => r.status !== "complete");
  const failed = results.filter((r) => r.status === "failed");
  return NextResponse.json(
    {
      ok: bad.length === 0,
      due: due.length,
      ran: results.length,
      leftForLater,
      ...(bad.length ? { error: bad.map((r) => `${r.practice}: ${r.status === "failed" ? "failed" : "partly read"}${r.error ? ` (${r.error})` : ""}`).join("; ") } : {}),
      results,
    },
    { status: failed.length ? 500 : bad.length ? 207 : 200 },
  );
}

// Vercel Cron calls with GET (vercel.json); POST stays for manual runs.
export const GET = watchedCronRoute("maps-rank", handle);
export const POST = GET;
