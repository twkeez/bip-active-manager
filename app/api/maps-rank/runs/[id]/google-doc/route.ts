import { NextResponse } from "next/server";
import { createGoogleDoc, driveFolderId, logoBanner, reportHtml } from "@/lib/maps-rank/google-doc";
import { renderMapPng } from "@/lib/maps-rank/map-image";
import { buildReport } from "@/lib/maps-rank/report";
import { loadRuns, loadTracker } from "@/lib/maps-rank/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuditAdmin } from "@/lib/website-audit/access";

export const maxDuration = 120;

/** Makes the run's report as a Google Doc in the tracker's Drive folder and returns its link. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const id = Number((await context.params).id);
  try {
    const admin = createAdminClient();
    const { data: found, error } = await admin.from("maps_rank_runs").select("id, tracker_id").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!found) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    const tracker = await loadTracker(admin, found.tracker_id as number);
    if (!tracker) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
    const folder = driveFolderId(tracker.drive_folder_url);
    if (!folder) return NextResponse.json({ error: "This tracker has no Google Drive folder yet. Add a folder link to it first." }, { status: 400 });
    const runs = await loadRuns(admin, tracker.id);
    const run = runs.find((r) => r.id === id);
    if (!run) return NextResponse.json({ error: "That run failed, so there is no report to make." }, { status: 400 });

    const report = buildReport(tracker, run, runs);
    const center = { lat: tracker.latitude, lng: tracker.longitude };
    const town = { lat: tracker.town_latitude, lng: tracker.town_longitude };
    const mapProblems: string[] = [];
    const maps = await Promise.all(
      run.results.searches.map((s) =>
        renderMapPng({ center, grid: s.grid, goal: s.goal, depth: run.results.depth, town }).catch((e: unknown) => {
          mapProblems.push(e instanceof Error ? e.message : "A map couldn't be drawn.");
          return null;
        }),
      ),
    );
    const html = reportHtml(report, { banner: await logoBanner(), maps });
    const date = new Date(run.ran_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const url = await createGoogleDoc(folder, `${tracker.practice_name} - Google Maps ranking report - ${date}`, html);
    const { error: saveError } = await admin.from("maps_rank_runs").update({ doc_url: url }).eq("id", run.id);
    return NextResponse.json({
      url,
      warning: [mapProblems.length ? `The Doc was made without ${mapProblems.length === 1 ? "one map" : `${mapProblems.length} maps`}: ${mapProblems[0]}` : null, saveError ? "The Doc was made but its link couldn't be saved here." : null].filter(Boolean).join(" ") || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't make the Google Doc." }, { status: 500 });
  }
}
