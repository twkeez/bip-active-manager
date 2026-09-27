import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { loadBriefableClients } from "@/lib/briefing/load";
import BriefingPreview from "@/components/briefing/briefing-preview";
import ReminderPlan from "@/components/briefing/reminder-plan";
import { loadReminderPlan } from "@/lib/briefing-reminders/load-plan";

/**
 * Step one of the client briefings: see one, before anything is sent.
 *
 * Admin-only while the wording is being judged. Strategists get their own view
 * once the content has earned it.
 */

export default async function ClientBriefingsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [clients, runs, params] = await Promise.all([
    loadBriefableClients(admin),
    loadReminderPlan(admin),
    searchParams,
  ]);
  const initialClientId = Number(params.client) || null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 p-6">
      {/* Keyed so a link from the reminder list re-opens on that client. */}
      <BriefingPreview key={initialClientId ?? "none"} clients={clients} initialClientId={initialClientId} />
      <ReminderPlan runs={runs} />
    </div>
  );
}
