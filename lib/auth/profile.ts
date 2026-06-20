import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "strategist";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

export async function getProfile(
  supabase: SupabaseClient,
): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  return data ?? null;
}

export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "admin";
}
