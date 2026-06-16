import { redirect } from "next/navigation";
import StrategyMapperShell from "@/components/strategy-mapper/strategy-mapper-shell";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingStrategyMapperPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return <StrategyMapperShell />;
}
