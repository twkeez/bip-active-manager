import { redirect } from "next/navigation";
import DataHealthView from "@/components/data-integrity/data-health-view";
import { getProfile } from "@/lib/auth/profile";
import type { DataWarning } from "@/lib/data-integrity/warnings";
import { createClient } from "@/lib/supabase/server";

export default async function DataHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data, error } = await supabase
    .from("data_warnings")
    .select("*")
    .order("resolved_at", { ascending: false, nullsFirst: true })
    .order("last_seen_at", { ascending: false });

  return (
    <DataHealthView
      warnings={(data ?? []) as DataWarning[]}
      loadError={
        error
          ? /could not find the table|does not exist/i.test(error.message)
            ? "The data warnings table does not exist yet. Run supabase/migrations/20260928120000_data_warnings.sql, then reload."
            : error.message
          : null
      }
    />
  );
}
