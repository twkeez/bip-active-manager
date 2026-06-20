import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import ReportTemplate from "@/components/reports/report-template";

export default async function ReportTemplatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");
  return <ReportTemplate />;
}
