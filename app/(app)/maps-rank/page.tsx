import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { GoogleDocButton, NewTrackerForm, RunNowButton } from "@/components/maps-rank/tracker-actions";
import { ToolPage } from "@/components/ui/tool-page";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { driveFolderId } from "@/lib/maps-rank/google-doc";
import { buildReport } from "@/lib/maps-rank/report";
import { DEPTH, GRID_SIZE } from "@/lib/maps-rank/scan";
import type { MapsRankRunRow, MapsRankTrackerRow } from "@/lib/maps-rank/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** About 0.2 cents per live Google Maps search. */
const SEARCH_USD = 0.002;
const CHANGE_CLASS = { better: "text-emerald-300", worse: "text-red-300", same: "text-bip-muted" } as const;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Maps Rank Tracker: each tracked client's Google Maps rank against its goals, run when someone presses Run now (the two-weekly schedule was stopped Nov 25, 2026). */
export default async function MapsRankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  const admin = createAdminClient();
  const [{ data: trackerRows, error }, { data: runRows, error: runError }, clients] = await Promise.all([
    admin.from("maps_rank_trackers").select("*").order("practice_name"),
    admin.from("maps_rank_runs").select("*").order("ran_at", { ascending: true }).limit(500),
    fetchAllRows<{ id: number; account_name: string; google_place_id: string | null }>((from, to) => admin.from("clients").select("id,account_name,google_place_id").order("account_name").range(from, to), "clients"),
  ]);
  const trackers = (trackerRows ?? []) as MapsRankTrackerRow[];
  const runs = (runRows ?? []) as MapsRankRunRow[];
  const loadError = error?.message ?? runError?.message ?? null;

  return (
    <ToolPage
      title="Maps Rank Tracker"
      icon={MapPin}
      maxWidth="6xl"
      description={`Where a client ranks in Google Maps for the searches they care about, checked from the same spots each run (automatic runs are paused; Run now still works), with a branded report (PDF or Google Doc) showing movement against the baseline and the goal. Each search is read from one fixed town point and from a ${GRID_SIZE}×${GRID_SIZE} grid around the practice; the first ${DEPTH} results are read at each spot.`}
      actions={<NewTrackerForm clients={clients.filter((c) => c.google_place_id && !trackers.some((t) => t.client_id === c.id)).map((c) => ({ id: c.id, name: c.account_name }))} />}
    >
      {loadError && <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">The tracker&apos;s data couldn&apos;t be loaded: {loadError}</p>}
      {!loadError && trackers.length === 0 && <p className="text-sm text-bip-muted">No clients are tracked yet.</p>}
      {trackers.map((tracker) => {
        const own = runs.filter((r) => r.tracker_id === tracker.id);
        const good = own.filter((r) => r.status !== "failed");
        const latest = good[good.length - 1];
        const report = latest ? buildReport(tracker, latest, good) : null;
        const cost = tracker.searches.length * (GRID_SIZE * GRID_SIZE + 1) * SEARCH_USD;
        const hasFolder = Boolean(driveFolderId(tracker.drive_folder_url));
        const nextDue = latest ? new Date(new Date(latest.ran_at).getTime() + tracker.every_days * 86_400_000) : null;
        return (
          <section key={tracker.id} className="space-y-3 rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-bip-text">{tracker.practice_name}</h2>
                <p className="text-xs text-bip-muted">
                  Headline rank searched from {tracker.town_label} · grid reaches {Number(tracker.radius_miles)} miles · every {tracker.every_days} days
                  {tracker.goal_date && ` · goals due ${new Date(`${tracker.goal_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  {!tracker.active && " · paused"}
                </p>
                <p className="text-xs text-bip-muted">
                  {nextDue && tracker.active ? `Next automatic run: ${nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : tracker.active ? "First automatic run: tomorrow morning, unless you run it now." : "Automatic runs are off."}
                  {!hasFolder && " No Google Drive folder set, so the Google Doc version is off."}
                </p>
              </div>
              <RunNowButton trackerId={tracker.id} practice={tracker.practice_name} costUsd={cost} />
            </div>
            {report && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
                      <th className="py-1.5 pr-3">Search</th>
                      <th className="py-1.5 pr-3">Goal</th>
                      <th className="py-1.5 pr-3">Baseline</th>
                      <th className="py-1.5 pr-3">Last report</th>
                      <th className="py-1.5 pr-3">Latest</th>
                      <th className="py-1.5 pr-3">Since baseline</th>
                      <th className="py-1.5 pr-3">From its address</th>
                      <th className="py-1.5">Grid points at goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.map((row) => (
                      <tr key={row.keyword} className="border-b border-bip-border/60 last:border-0">
                        <td className="py-1.5 pr-3 font-medium text-bip-text">{row.keyword}</td>
                        <td className="py-1.5 pr-3">Top {row.goal}</td>
                        <td className="py-1.5 pr-3">{row.baselineLabel}</td>
                        <td className="py-1.5 pr-3">{row.lastLabel}</td>
                        <td className={`py-1.5 pr-3 font-semibold ${row.goalMet ? "text-emerald-300" : "text-bip-text"}`}>{row.todayLabel}</td>
                        <td className={`py-1.5 pr-3 ${row.change ? CHANGE_CLASS[row.change] : "text-bip-muted"}`}>{row.changeLabel}</td>
                        <td className="py-1.5 pr-3">{row.addressLabel}</td>
                        <td className="py-1.5">
                          {row.pointsAtGoal} of {row.pointsRead}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {own.length === 0 ? (
              <p className="text-sm text-bip-muted">Not run yet.</p>
            ) : (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-bip-muted">Runs</p>
                <ul className="mt-1 divide-y divide-bip-border/60 text-sm">
                  {[...own].reverse().map((run) => (
                    <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
                      <span className="w-44 text-bip-text">{dateTime(run.ran_at)}</span>
                      {run.status === "failed" ? (
                        <span className="text-red-300">Failed: {run.error ?? "no searches could be read."}</span>
                      ) : (
                        <>
                          <a href={`/maps-rank-print/${run.id}`} target="_blank" rel="noreferrer" className="text-sm text-bip-accent underline">
                            Report (PDF)
                          </a>
                          <GoogleDocButton runId={run.id} docUrl={run.doc_url} hasFolder={hasFolder} />
                          {run.status === "partial" && <span className="text-amber-300">Partly read: {run.error}</span>}
                        </>
                      )}
                      <span className="ml-auto text-xs text-bip-muted">${Number(run.cost_usd).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-bip-muted">
        Limits: the first {DEPTH} results are read at each spot, so a rank further down shows as &quot;not in the top {DEPTH}&quot;. Paid listings are left out. The automatic check runs at most 4 clients a day and carries the rest to
        the next day. This page lists each client&apos;s most recent 500 runs in total.
      </p>
    </ToolPage>
  );
}
