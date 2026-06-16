import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchServiceTiers, fetchPlaybookItems } from "@/lib/playbook/queries";
import PlaybookLibrary from "@/components/playbook/playbook-library";

export default async function PlaybookPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const isAdmin = profile?.role === "admin";

  const [tiers, items] = await Promise.all([
    fetchServiceTiers(supabase),
    fetchPlaybookItems(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Service Playbook</h1>
        <p className="text-sm text-[rgba(255,255,255,0.4)]">
          Best practices, deliverables, and guidelines by service tier.
          {isAdmin && " Click any item to edit."}
        </p>
      </div>
      <PlaybookLibrary tiers={tiers} initialItems={items} isAdmin={isAdmin} />
    </div>
  );
}
