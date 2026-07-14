import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingSection from "@/components/onboarding/onboarding-section";

// Top-level Onboarding section: the queue of clients currently onboarding plus
// the step-by-step wizard, all in one place. Composes the existing onboarding
// engine (GET /api/clients/onboarding), the New client drawer, and the wizard.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <OnboardingSection />;
}
