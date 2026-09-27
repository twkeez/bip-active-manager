import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { landingPathForRole, resolveEffectiveRole, VIEW_AS_COOKIE } from "@/lib/auth/effective-role";

/**
 * The Dashboard was retired on 2026-09-26. Its Comms Monitor is covered by the
 * Response Report, its tasks by My Tasks, its sync buttons by the scheduled
 * jobs, and its SEO audits panel moved to My Tasks.
 *
 * The address stays because sign-in and about a dozen admin-only pages send
 * people here. It now forwards to where that person should land.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  const cookieStore = await cookies();
  const role = resolveEffectiveRole(profile?.role ?? "strategist", cookieStore.get(VIEW_AS_COOKIE)?.value);
  redirect(landingPathForRole(role));
}
