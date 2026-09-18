import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import RoutinesBoard from "@/components/routines/routines-board";

/** The app's own routines: scheduled jobs someone asked for, and what they found. */
export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <RoutinesBoard />
    </div>
  );
}
