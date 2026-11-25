import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
import { parseGrants } from "@/lib/auth/sections";
import TeamManager, { type TeamMember } from "@/components/team/team-manager";

type ProfileRow = Omit<TeamMember, "grants"> & { section_grants?: unknown };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  // Service-role read so we can also surface invited-but-not-yet-confirmed users.
  // section_grants comes from a migration applied by hand; until it is, read
  // without it and say on the page that section access can't be saved yet.
  const admin = createAdminClient();
  const read = (columns: string) =>
    admin.from("profiles").select(columns).order("full_name", { ascending: true }).returns<ProfileRow[]>();

  let grantsColumn = true;
  let result = await read("id, email, full_name, role, section_grants");
  if (result.error?.code === "42703") {
    grantsColumn = false;
    result = await read("id, email, full_name, role");
  }
  if (result.error) throw new Error(`Could not read the team: ${result.error.message}`);

  const members: TeamMember[] = (result.data ?? []).map(({ section_grants, ...member }) => ({
    ...member,
    grants: member.role === "strategist" ? parseGrants(section_grants) : [],
  }));

  return <TeamManager initialMembers={members} currentUserId={user.id} grantsColumn={grantsColumn} />;
}
