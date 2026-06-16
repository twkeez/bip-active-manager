import { redirect } from "next/navigation";
import ConversionIntegrityRadar from "@/components/dashboard/conversion-integrity-radar";
import { loadConversionIntegrityData } from "@/lib/dashboard/load-conversion-integrity-data";
import { createClient } from "@/lib/supabase/server";
export default async function ConversionIntegrityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const data = await loadConversionIntegrityData(supabase);
  return (
    <ConversionIntegrityRadar
      anomalies={data.anomalies}
      summary={data.summary}
      lastAdsSyncAt={data.lastAdsSyncAt}
      userEmail={user.email}
      loadError={data.loadError}
    />
  );
}
