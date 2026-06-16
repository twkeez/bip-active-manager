import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LlmsTxtManager from "@/components/llms-txt/llms-txt-manager";
import type { LlmsTxtClientOption } from "@/lib/llms-txt/types";

export default async function LlmsTxtPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("clients")
    .select("id, account_name, website")
    .not("website", "is", null)
    .neq("website", "")
    .order("account_name", { ascending: true });

  const clients = ((data ?? []) as LlmsTxtClientOption[]).filter((c) =>
    (c.website ?? "").trim(),
  );

  return <LlmsTxtManager clients={clients} userEmail={user.email} />;
}
