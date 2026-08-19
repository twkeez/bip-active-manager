import { redirect } from "next/navigation";
import ReputationManager from "@/components/reputation/reputation-manager";
import { createClient } from "@/lib/supabase/server";

export default async function ReputationPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Only clients with a Place ID can be looked up at all — 215 of 248 today.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, account_name, google_place_id")
    .not("google_place_id", "is", null)
    .order("account_name");

  const options = (clients ?? [])
    .filter((row) => (row.google_place_id ?? "").trim().length > 0)
    .map((row) => ({ id: row.id as number, name: row.account_name as string }));

  const requested = Number((await searchParams).clientId);
  const initialClientId =
    options.find((option) => option.id === requested)?.id ?? options[0]?.id ?? null;

  return (
    <ReputationManager
      userEmail={user.email}
      clients={options}
      initialClientId={initialClientId}
    />
  );
}
