import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/** Poobah Client Watch pages are for admins; anyone else is sent elsewhere. */
export async function requirePoobahAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/client-watch");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/");
}
