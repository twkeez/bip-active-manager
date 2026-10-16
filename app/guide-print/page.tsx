import { redirect } from "next/navigation";
import GuidePrintClient from "@/components/guide/guide-print-client";
import { createClient } from "@/lib/supabase/server";

// Chrome-free print view of the team guide, to save as a PDF and share. Lives
// outside the (app) route group so it prints without the sidebar.
export default async function GuidePrintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <GuidePrintClient />;
}
