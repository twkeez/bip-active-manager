import { redirect } from "next/navigation";
import ReputationManager from "@/components/reputation/reputation-manager";
import ReputationUnavailable from "@/components/reputation/reputation-unavailable";
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

  // Arriving from a client workspace (?clientId=…) pins the tool to that client:
  // the picker is locked so nobody can drift onto a neighbouring account while
  // the page still says they came from this one.
  const requestedRaw = (await searchParams).clientId;
  const requested = Number(requestedRaw);
  const arrivedFromClient = Boolean(requestedRaw) && Number.isInteger(requested);
  const matched = options.find((option) => option.id === requested) ?? null;

  // Only ~215 of 248 clients have a Place ID, so a client can be asked for and
  // legitimately absent. Say so rather than silently falling back to whichever
  // client sorts first — that used to show one client's reviews under another
  // client's name.
  if (arrivedFromClient && !matched) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("account_name")
      .eq("id", requested)
      .maybeSingle();

    return (
      <ReputationUnavailable
        clientName={(clientRow?.account_name as string | undefined) ?? null}
        clientId={requested}
      />
    );
  }

  return (
    <ReputationManager
      userEmail={user.email}
      clients={arrivedFromClient && matched ? [matched] : options}
      initialClientId={matched?.id ?? options[0]?.id ?? null}
      lockedToClient={arrivedFromClient}
    />
  );
}
