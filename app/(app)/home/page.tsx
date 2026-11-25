import { redirect } from "next/navigation";
import HomeView from "@/components/home/home-view";
import { getProfile } from "@/lib/auth/profile";
import { loadRosterReport } from "@/lib/basecamp/load-roster-report";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { buildHomeSummary, chooseHomeView } from "@/lib/home/home-summary";
import { loadMonthlyList } from "@/lib/reporting/monthly-list";
import { defaultReportMonth } from "@/lib/reporting/monthly";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Home: where a strategist starts the day. Who's waiting on us (the Response
 * Report's Basecamp data) and last month's reports (Monthly reports), for the
 * viewer's own clients or for everyone. Read-only; every action happens on the
 * page each line links to.
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

  const [report, monthly, assigned] = await Promise.all([
    loadRosterReport(supabase),
    loadMonthlyList(supabase, month, isAdmin),
    // The clients assigned to this person, as the clients' access rule reads them.
    fetchAllRows<{ id: number }>(
      (from, to) =>
        supabase
          .from("clients")
          .select("id")
          .or(`strategist_user_id.eq.${user.id},strategist_user_ids.cs.{${user.id}}`)
          .order("id")
          .range(from, to),
      "Your assigned clients",
    ).then(
      (rows) => ({ ids: new Set(rows.map((row) => row.id)), error: null as string | null }),
      (error: unknown) => ({ ids: new Set<number>(), error: error instanceof Error ? error.message : String(error) }),
    ),
  ]);

  const { view: requested } = await searchParams;
  // If the assignments can't be read, say so and show everyone rather than an empty "mine".
  const view = assigned.error ? "all" : chooseHomeView(requested, assigned.ids.size);

  const sheetStrategist = new Map<number, string | null>();
  for (const entry of report.roster.entries) {
    if (entry.clientId != null && !sheetStrategist.has(entry.clientId)) sheetStrategist.set(entry.clientId, entry.strategist);
  }

  const summary = buildHomeSummary({
    reportRows: report.rows,
    monthlyRows: monthly.error ? [] : monthly.rows,
    view,
    mine: assigned.ids,
    sheetStrategist,
  });

  return (
    <HomeView
      summary={summary}
      view={view}
      assignedCount={assigned.ids.size}
      assignedError={assigned.error}
      month={month}
      reportLoad={{
        rosterApplied: report.rosterApplied,
        lastSyncedAt: report.lastSyncedAt,
        loadError: report.loadError,
      }}
      monthlyLoad={{ error: monthly.error, warnings: monthly.warnings, statesTracked: monthly.statesTracked }}
    />
  );
}
