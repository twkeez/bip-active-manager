import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import BestPracticesEditor from "@/components/best-practices/best-practices-editor";

// Editable constants that power the onboarding assists (negatives, campaign
// skeleton, constant keywords). Admin only.
export default async function BestPracticesPage() {
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
        <h1 className="text-lg font-semibold text-bip-text">Best Practices</h1>
        <p className="text-sm text-bip-muted">
          The constants we always apply. Onboarding assists start from these and let AI
          fill only the practice-specific variances.
        </p>
      </div>
      <BestPracticesEditor />
    </div>
  );
}
