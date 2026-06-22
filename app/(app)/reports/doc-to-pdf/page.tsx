import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocToPdf from "@/components/reports/doc-to-pdf";

export default async function DocToPdfPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <DocToPdf />;
}
