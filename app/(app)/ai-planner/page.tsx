import { redirect } from "next/navigation";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { AiPlanner } from "@/components/ai-planner/ai-planner";

export const metadata = { title: "AI Planner" };

export type PlannerClient = {
  id: number;
  account_name: string;
  website: string | null;
};

export default async function AiPlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, account_name, website")
    .order("account_name", { ascending: true });

  return <AiPlanner clients={(clients ?? []) as PlannerClient[]} />;
}
