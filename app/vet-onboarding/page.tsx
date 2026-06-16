import { redirect } from "next/navigation";
import VetClientOnboarding from "@/components/vet-onboarding/vet-client-onboarding";
import { createClient } from "@/lib/supabase/server";

export default async function VetOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return <VetClientOnboarding userEmail={user.email} />;
}
