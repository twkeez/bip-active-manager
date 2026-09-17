import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { loadBriefableClients } from "@/lib/briefing/load";
import BriefingPreview from "@/components/briefing/briefing-preview";

/**
 * Step one of the client briefings: see one, before anything is sent.
 *
 * Admin-only while the wording is being judged. Strategists get their own view
 * once the content has earned it.
 */

export default async function ClientBriefingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const clients = await loadBriefableClients(createAdminClient());

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <BriefingPreview clients={clients} />
    </div>
  );
}
