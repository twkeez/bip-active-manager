import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import TeamManager, { type TeamMember } from "@/components/team/team-manager";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  // Service-role read so we can also surface invited-but-not-yet-confirmed users.
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .order("full_name", { ascending: true });

  const members: TeamMember[] = (profiles ?? []) as TeamMember[];

  return <TeamManager initialMembers={members} currentUserId={user.id} />;
}
