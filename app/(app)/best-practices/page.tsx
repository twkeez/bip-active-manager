import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import BestPracticesEditor from "@/components/best-practices/best-practices-editor";

// Editable constants that power the onboarding assists (negatives, campaign
// skeleton, constant keywords). Admin only.
export default async function BestPracticesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const { q } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Best Practices</h1>
        <p className="text-sm text-bip-muted">
          The constants we always apply, plus the “I have this issue” playbook — codified fixes for
          common ads and SEO problems. Search a symptom, read the fix. Assists and the diagnostics build on these.
        </p>
      </div>
      <BestPracticesEditor initialQuery={q ?? ""} />
    </div>
  );
}
