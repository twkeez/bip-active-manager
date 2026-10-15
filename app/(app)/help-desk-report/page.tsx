import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { getZendeskConfig } from "@/lib/env";
import { getServiceAccountEmail } from "@/lib/google/master-sheet-source";
import { sheetUrl } from "@/lib/google/sheets-writer";
import { getHelpDeskReportSheetId } from "@/lib/help-desk/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import HelpDeskReportRunner from "@/components/help-desk/help-desk-report-runner";

export const dynamic = "force-dynamic";

/**
 * Help Desk Report: Zendesk tickets for each client on the Master Sheet —
 * who writes in, what they ask for, how often, and when last — written to a
 * Google Sheet. Admin-only: ticket text is client correspondence.
 */
export default async function HelpDeskReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const count = async (table: string, categorizedOnly = false) => {
    let query = admin.from(table).select("id", { count: "exact", head: true });
    if (categorizedOnly) query = query.not("categorized_at", "is", null);
    const { count: n } = await query;
    return n ?? 0;
  };

  const [tickets, categorized, users, organizations, stateResult, runResult] = await Promise.all([
    count("zendesk_tickets"),
    count("zendesk_tickets", true),
    count("zendesk_users"),
    count("zendesk_organizations"),
    admin.from("zendesk_sync_state").select("stream, caught_up, last_run_at, last_error"),
    admin
      .from("help_desk_report_runs")
      .select("ran_at, ran_by, summary")
      .order("ran_at", { ascending: false })
      .limit(1),
  ]);

  const streams = (stateResult.data ?? []) as {
    stream: string;
    caught_up: boolean;
    last_run_at: string | null;
    last_error: string | null;
  }[];
  const lastRun = (runResult.data?.[0] ?? null) as {
    ran_at: string;
    ran_by: string | null;
    summary: Record<string, number | string>;
  } | null;

  return (
    <HelpDeskReportRunner
      zendeskConfigured={getZendeskConfig() !== null}
      anthropicConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
      serviceAccountEmail={getServiceAccountEmail() || null}
      sheetUrl={sheetUrl(getHelpDeskReportSheetId())}
      counts={{ tickets, categorized, users, organizations }}
      streams={streams}
      lastRun={lastRun}
    />
  );
}
