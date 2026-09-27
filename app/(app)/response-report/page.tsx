import { redirect } from "next/navigation";
import ResponseReportView from "@/components/basecamp/response-report-view";
import { loadResponseReport } from "@/lib/basecamp/load-response-report";
import type { FollowupRow } from "@/lib/followups/followups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ResponseReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ rows, ignored, lastSyncedAt, loadError }, staffResult, followupResult] = await Promise.all([
    loadResponseReport(supabase),
    // Profiles are RLS-restricted to your own row, so the teammate list for
    // "Notify strategist" is read with the service role (names and emails only).
    createAdminClient().from("profiles").select("full_name,email").not("email", "is", null),
    // Your own notes only: scheduled client-update reminders live on Follow-ups.
    supabase.from("strategist_followups").select("*").eq("state", "open").eq("kind", "note"),
  ]);

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
    />
  );
}
