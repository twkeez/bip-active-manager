import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import KickoffTemplateEditor from "@/components/onboarding/kickoff-template-editor";
import { SERVICE_TIER_TABLES, type ServiceTierTable } from "@/lib/services/tier-content";

export default async function OnboardingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  // The tiers as published on /services, so the copy written here can be
  // checked against what each tier actually includes.
  const { data: tierRow } = await supabase
    .from("service_content")
    .select("data")
    .eq("content_key", "tiers")
    .maybeSingle();
  const tierTables = (tierRow?.data as ServiceTierTable[] | null) ?? SERVICE_TIER_TABLES;

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Onboarding Basecamp Message</h1>
        <p className="text-sm text-bip-muted">
          The master kickoff message posted to a new client&rsquo;s Basecamp project. Onboarding fills in the
          practice&rsquo;s own details when it writes the message, and each client reads the wording for the tier
          they bought.
        </p>
      </div>
      <KickoffTemplateEditor tierTables={tierTables} />
    </div>
  );
}
