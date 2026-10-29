import { redirect } from "next/navigation";
import ResponseReportTabs from "@/components/basecamp/response-report-tabs";
import ResponseReportView from "@/components/basecamp/response-report-view";
import FollowupsView from "@/components/followups/followups-view";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { loadFollowups } from "@/lib/followups/load";
import { STATUS_FILTERS, type StatusFilter } from "@/lib/basecamp/response-report";
import { loadResponseReport } from "@/lib/basecamp/load-response-report";
import type { FollowupRow } from "@/lib/followups/followups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ResponseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Follow-ups (formerly their own page) are a tab here, for admins.
  const { status, tab } = await searchParams;
  const admin = isAdmin(await getProfile(supabase));
  const followups = admin ? await loadFollowups(supabase) : null;
  const tabs = followups ? (
    <ResponseReportTabs active={tab === "followups" ? "followups" : "projects"} openFollowups={followups.open.length} />
  ) : null;
  if (followups && tab === "followups") {
    return <FollowupsView open={followups.open} done={followups.done} loadError={followups.loadError} tabs={tabs} />;
  }

  const [{ rows, ignored, lastSyncedAt, loadError }, staffResult, followupResult] = await Promise.all([
    loadResponseReport(supabase),
    // Profiles are RLS-restricted to your own row, so the teammate list for
    // "Notify strategist" is read with the service role (names and emails only).
    createAdminClient().from("profiles").select("full_name,email").not("email", "is", null),
    // Your own notes only: scheduled client-update reminders live on Follow-ups.
    supabase.from("strategist_followups").select("*").eq("state", "open").eq("kind", "note"),
  ]);

  const initialStatus = STATUS_FILTERS.includes(status as StatusFilter) ? (status as StatusFilter) : null;

  const staff = ((staffResult.data ?? []) as { full_name: string | null; email: string | null }[])
    .filter((person) => person.email)
    .map((person) => ({ name: person.full_name?.trim() || person.email!, email: person.email!.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ResponseReportView
      rows={rows}
      ignored={ignored}
      staff={staff}
      openFollowups={(followupResult.data ?? []) as FollowupRow[]}
      lastSyncedAt={lastSyncedAt}
      loadError={loadError}
      initialStatus={initialStatus}
      tabs={tabs}
    />
  );
}
