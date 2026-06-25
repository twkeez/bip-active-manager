import { redirect } from "next/navigation";
import WinsStudio from "@/components/wins/wins-studio";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";

export default async function WinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }
  return <WinsStudio />;
}
