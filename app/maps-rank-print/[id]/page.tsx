import { notFound, redirect } from "next/navigation";
import MapsRankReportView from "@/components/maps-rank/maps-rank-report";
import ReportPrintShell from "@/components/website-audit/report-print-shell";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { renderMapPng } from "@/lib/maps-rank/map-image";
import { buildReport } from "@/lib/maps-rank/report";
import { loadRuns, loadTracker } from "@/lib/maps-rank/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The branded Maps ranking report for one run, to save as a PDF. Outside the
// (app) route group so it prints without the sidebar. The maps are drawn on the
// server and sent inside the page, so they are there when the print dialog opens.
export default async function MapsRankPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  const id = Number((await params).id);
  const admin = createAdminClient();
  const { data: found } = await admin.from("maps_rank_runs").select("id, tracker_id").eq("id", id).maybeSingle();
  if (!found) notFound();
  const tracker = await loadTracker(admin, found.tracker_id as number);
  if (!tracker) notFound();
  const runs = await loadRuns(admin, tracker.id);
  const run = runs.find((r) => r.id === id);
  if (!run) notFound();

  const report = buildReport(tracker, run, runs);
  const center = { lat: tracker.latitude, lng: tracker.longitude };
  const town = { lat: tracker.town_latitude, lng: tracker.town_longitude };
  const maps = await Promise.all(
    run.results.searches.map((s) =>
      renderMapPng({ center, grid: s.grid, goal: s.goal, depth: run.results.depth, town })
        .then((png) => `data:image/png;base64,${png.toString("base64")}`)
        .catch(() => null),
    ),
  );

  return (
    <ReportPrintShell title={`${tracker.practice_name} · Google Maps Ranking Report · Beyond Indigo Pets`}>
      <MapsRankReportView report={report} maps={maps} />
    </ReportPrintShell>
  );
}
