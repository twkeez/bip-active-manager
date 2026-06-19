import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportTemplate from "@/components/reports/report-template";

export default async function ReportTemplatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <ReportTemplate />;
}
