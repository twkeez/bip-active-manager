import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ClientListShell from "@/components/dashboard/client-list/client-list-shell";
import { loadClientListData } from "@/lib/dashboard/load-client-list-data";
import { redirectLegacyClientQuery } from "@/lib/dashboard/redirect-legacy-client-query";
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ basecamp?: string; clientId?: string; tab?: string }>;
}) {
  const params = await searchParams;
  redirectLegacyClientQuery(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await loadClientListData(supabase);
  if (data.loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bip-page p-8">
        
        <p className="max-w-md text-center text-sm text-red-400">
          
          Could not load clients: {data.loadError}. If you just created the
          table, apply the RLS migration{""}
          <code className="rounded bg-bip-card px-1 text-white/75">
            
            20260501130000_clients_rls_authenticated.sql
          </code>
          {""} in the Supabase SQL editor and ensure you are signed in.
        </p>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/50">
          Loading clients…
        </div>
      }
    >
      
      <ClientListShell
        key={`${data.syncState?.updated_at ?? "none"}:${data.clients.length}`}
        {...data}
        userEmail={user?.email}
        basecampStatus={params.basecamp}
      />
    </Suspense>
  );
}
