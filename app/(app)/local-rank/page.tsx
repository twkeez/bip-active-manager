import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LocalRankManager from "@/components/local-rank/local-rank-manager";
import type { ClientRow } from "@/lib/types/client";

export default async function LocalRankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bip-page p-8 text-sm text-red-400">
        Could not load clients: {error.message}
      </div>
    );
  }

  return (
    <LocalRankManager
      clients={(clients ?? []) as ClientRow[]}
      userEmail={user.email}
    />
  );
}
