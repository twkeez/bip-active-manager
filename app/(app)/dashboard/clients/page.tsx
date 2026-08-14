import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientsDirectory } from "@/components/clients/clients-directory";
import type { ClientRow } from "@/lib/types/client";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The redesigned directory needs identity, strategist, lifecycle state and
  // the five service flags — nothing else. Signals, thread previews and
  // freshness are deliberately not loaded here any more.
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, account_name, marketing_strategist, onboarding_status, awaiting_website_launch, seo, ppc, smm, orm, blog, tier",
    )
    .order("account_name", { ascending: true });

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <p className="max-w-md text-center text-sm text-red-500">
          Could not load clients: {error.message}
        </p>
      </div>
    );
  }

  return <ClientsDirectory clients={(data ?? []) as ClientRow[]} />;
}
