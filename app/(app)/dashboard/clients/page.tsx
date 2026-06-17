import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadClientListData } from "@/lib/dashboard/load-client-list-data";
import ClientListView from "@/components/clients/client-list-view";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await loadClientListData(supabase);

  if (data.loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <p className="max-w-md text-center text-sm text-red-400">
          Could not load clients: {data.loadError}
        </p>
      </div>
    );
  }

  return <ClientListView {...data} />;
}
