import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { SocialPlannerStudio } from "@/components/social/social-planner-studio";
import type { SocialIdea } from "@/lib/social/types";

export const metadata = { title: "Social Planner" };

export default async function SocialPlannerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: ideas } = await admin
    .from("social_idea_repository")
    .select("*")
    .order("campaign_type")
    .order("title")
    .returns<SocialIdea[]>();

  return <SocialPlannerStudio initialIdeas={ideas ?? []} />;
}
