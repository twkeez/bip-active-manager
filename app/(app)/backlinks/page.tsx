import { redirect } from "next/navigation";
import BacklinksManager from "@/components/backlinks/backlinks-manager";
import { createClient } from "@/lib/supabase/server";

// First slice targets one client. The next slice swaps this for a picker over
// SEO-active clients; until then ?clientId= is the escape hatch for spot checks.
const DEFAULT_CLIENT_ID = 74;

export default async function BacklinksPage({
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

  const requested = Number((await searchParams).clientId);
  const clientId = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_CLIENT_ID;

  const { data: client } = await supabase
    .from("clients")
    .select("account_name, website")
    .eq("id", clientId)
    .maybeSingle();

  return (
    <BacklinksManager
      userEmail={user.email}
      clientName={client?.account_name ?? null}
      initialTarget={client?.website ?? ""}
    />
  );
}
