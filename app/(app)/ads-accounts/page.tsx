import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import AdsAccountLinker from "@/components/ads/ads-account-linker";

/** Attaching ads accounts to the clients paying for ads without one. */
export default async function AdsAccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <AdsAccountLinker />
    </div>
  );
}
