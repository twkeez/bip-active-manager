import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import ClientExpectationsEditor from "@/components/onboarding/client-expectations-editor";

export default async function ClientExpectationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, account_name")
    .order("account_name", { ascending: true });
  const clients = (clientRows ?? []) as Array<{ id: number; account_name: string }>;

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-bip-text">Client Expectations</h1>
        <p className="text-sm text-bip-muted">
          Author the per-service expectations we share with clients before kickoff, then generate a branded
          PDF or Word document for any client.
        </p>
      </div>
      <ClientExpectationsEditor clients={clients} />
    </div>
  );
}
