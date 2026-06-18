import BulkDiscoverView from "@/components/dashboard/bulk-discover-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BulkDiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <BulkDiscoverView />;
}
