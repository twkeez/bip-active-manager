import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ControlCenter } from "@/components/control-center/control-center";

export const metadata = { title: "Control Center" };

export type ControlCenterClient = {
  id: number;
  account_name: string;
  marketing_strategist: string | null;
  tier: string | null;
};

export default async function ControlCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, account_name, marketing_strategist, tier")
    .order("account_name", { ascending: true });

  return <ControlCenter clients={(clients ?? []) as ControlCenterClient[]} />;
}
