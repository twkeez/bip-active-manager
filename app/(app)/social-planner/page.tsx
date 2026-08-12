import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { SocialPlannerStudio } from "@/components/social/social-planner-studio";
import type { SocialIdea } from "@/lib/social/types";

export const metadata = { title: "Social Planner" };

export default async function SocialPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);

  const admin = createAdminClient();
  const [{ data: ideas }, { data: clients }] = await Promise.all([
    admin
      .from("social_idea_repository")
      .select("*")
      .order("campaign_type")
      .order("title")
      .returns<SocialIdea[]>(),
    admin
      .from("clients")
      .select("id, account_name")
      .order("account_name")
      .returns<{ id: number; account_name: string }[]>(),
  ]);

  const initialClientId = clientParam && Number.isInteger(Number(clientParam)) ? Number(clientParam) : undefined;

  return (
    <SocialPlannerStudio
      initialIdeas={ideas ?? []}
      clients={clients ?? []}
      isAdminUser={isAdmin(profile)}
      initialClientId={initialClientId}
    />
  );
}
