import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import OnboardingHome from "@/components/onboarding/onboarding-home";

// Onboarding, rebuilt 2026-09-16 around what it produces: upload the pipeline
// form (and the website team's kickoff doc), check the details, let the
// research run, and get the Basecamp message and the client document. The old
// step-by-step checklist no longer appears here.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Research runs Claude with web search, and every research route is
  // admin-only, so the page is too.
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const { client } = await searchParams;
  const initialClientId = Number(client);
  return <OnboardingHome initialClientId={Number.isInteger(initialClientId) && initialClientId > 0 ? initialClientId : undefined} />;
}
