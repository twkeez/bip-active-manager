import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import OnboardingSopEditor from "@/components/onboarding/onboarding-sop-editor";

// Living document: edit the SOP shown on each onboarding wizard step. Admin only.
export default async function OnboardingSopsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Onboarding SOPs</h1>
        <p className="text-sm text-bip-muted">
          The step-by-step process shown on each onboarding step. Edit freely — changes
          apply to new clients and everyone currently in onboarding.
        </p>
      </div>
      <OnboardingSopEditor />
    </div>
  );
}
