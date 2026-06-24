import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth/profile";

/** True if the current session belongs to an admin. Used to gate admin-only
 *  routes (e.g. the personal email-triage endpoints). */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const profile = await getProfile(supabase);
  return profile?.role === "admin";
}
