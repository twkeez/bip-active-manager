import { redirect } from "next/navigation";
import MonthlyReportList from "@/components/reporting/monthly-list";
import { getProfile } from "@/lib/auth/profile";
import { loadMonthlyList } from "@/lib/reporting/monthly-list";
import { parseReportMonth, recentMonths } from "@/lib/reporting/monthly";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

/**
 * Reporting home: this month's reports for every client the viewer can see.
 * Strategists reach it with the Reporting section granted on the Team page;
 * everything here reads with their own session, so they see only their clients.
 */
export default async function ReportingPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  const isAdmin = profile?.role === "admin";

  const { month: requested } = await searchParams;
  const now = new Date();
  const month = parseReportMonth(requested, now);
  const list = await loadMonthlyList(supabase, month, isAdmin);

  // The current month and six before it, plus an older one asked for by link.
  const months = recentMonths(7, now);
  if (!months.includes(month)) months.push(month);

  return <MonthlyReportList list={list} months={months} isAdmin={isAdmin} />;
}
