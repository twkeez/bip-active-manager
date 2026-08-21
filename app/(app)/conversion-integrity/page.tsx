import { redirect } from "next/navigation";
import ConversionIntegrityRadar from "@/components/dashboard/conversion-integrity-radar";
import { loadConversionIntegrityData } from "@/lib/dashboard/load-conversion-integrity-data";
import { createClient } from "@/lib/supabase/server";
import { resolveFocusClient } from "@/lib/dashboard/focus-client";
export default async function ConversionIntegrityPage({
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
  const data = await loadConversionIntegrityData(supabase);
  const focusClient = await resolveFocusClient(supabase, searchParams);
  return (
    <ConversionIntegrityRadar
      anomalies={data.anomalies}
      summary={data.summary}
      lastAdsSyncAt={data.lastAdsSyncAt}
      userEmail={user.email}
      loadError={data.loadError}
      focusClient={focusClient}
    />
  );
}
