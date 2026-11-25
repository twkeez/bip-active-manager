import { redirect } from "next/navigation";
import HomeView from "@/components/home/home-view";
import { getProfile } from "@/lib/auth/profile";
import { loadRosterReport } from "@/lib/basecamp/load-roster-report";
import { loadWatchReads } from "@/lib/client-watch/load";
import { buildHomeSummary, buildHomeWatch, chooseHomeView, strategistNames, viewerSheetNames } from "@/lib/home/home-summary";
import { loadMonthlyList } from "@/lib/reporting/monthly-list";
import { defaultReportMonth } from "@/lib/reporting/monthly";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Home: where a strategist starts the day. Who's waiting on us (the Response
 * Report's Basecamp data), Client Watch (Claude's read of each client's
 * threads) and last month's reports (Monthly reports), for the viewer's own
 * clients (by the Master Sheet's Strategist column) or for everyone. The one
 * action here is reading a client for Client Watch again; everything else
 * happens on the page each line links to.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  const isAdmin = profile?.role === "admin";
  const month = defaultReportMonth();

  const [report, monthly, reads] = await Promise.all([
    loadRosterReport(supabase),
    loadMonthlyList(supabase, month, isAdmin),
    loadWatchReads(supabase),
  ]);

  // My clients: roster clients whose Strategist on the Master Sheet names you.
  const names = viewerSheetNames(profile);
  const sheetStrategist = new Map<number, string | null>();
  const mine = new Set<number>();
  for (const entry of report.roster.entries) {
    if (entry.clientId == null) continue;
    if (!sheetStrategist.has(entry.clientId)) sheetStrategist.set(entry.clientId, entry.strategist);
    if (strategistNames(entry.strategist, names)) mine.add(entry.clientId);
  }
  // Without the sheet there's no way to tell whose clients are whose: say so and show everyone.
  const mineError = report.roster.error
    ? `The Master Sheet couldn't be read, so this shows everyone. ${report.roster.error}`
    : names.length === 0
      ? "Your profile has no name to look for in the Master Sheet's Strategist column, so this shows everyone."
      : null;

  const { view: requested } = await searchParams;
  const view = mineError ? "all" : chooseHomeView(requested, mine.size);

  const summary = buildHomeSummary({
    reportRows: report.rows,
    monthlyRows: monthly.error ? [] : monthly.rows,
    view,
    mine,
    sheetStrategist,
  });

  const now = new Date();
  const watch = buildHomeWatch({
    reportRows: report.loadError ? [] : report.rows,
    latest: reads.latest,
    attempts: reads.attempts,
    view,
    mine,
    sheetStrategist,
    now,
  });

  return (
    <HomeView
      summary={summary}
      view={view}
      mineCount={mine.size}
      mineError={mineError}
      sheetName={names[0] ?? null}
      month={month}
      reportLoad={{
        rosterApplied: report.rosterApplied,
        lastSyncedAt: report.lastSyncedAt,
        loadError: report.loadError,
      }}
      monthlyLoad={{ error: monthly.error, warnings: monthly.warnings, statesTracked: monthly.statesTracked }}
      watch={watch}
      watchLoad={{ lastReadAt: reads.lastReadAt, setupError: reads.setupError, loadError: reads.loadError }}
      now={now}
    />
  );
}
