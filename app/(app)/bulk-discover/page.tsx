import BulkDiscoverView from "@/components/dashboard/bulk-discover-view";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { redirect } from "next/navigation";

export default async function BulkDiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");
  return <BulkDiscoverView />;
}
