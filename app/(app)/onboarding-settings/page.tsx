import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import KickoffTemplateEditor from "@/components/onboarding/kickoff-template-editor";

export default async function OnboardingSettingsPage() {
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
        <h1 className="text-lg font-semibold text-bip-text">Onboarding Settings</h1>
        <p className="text-sm text-bip-muted">
          Master kickoff message template used across client onboarding.
        </p>
      </div>
      <KickoffTemplateEditor />
    </div>
  );
}
