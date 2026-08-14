import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SidebarSwitch from "@/components/layout/sidebar-switch";
import { getProfile } from "@/lib/auth/profile";
import { resolveEffectiveRole, VIEW_AS_COOKIE } from "@/lib/auth/effective-role";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(supabase);
  const actualRole = profile?.role ?? "strategist";
  const cookieStore = await cookies();
  const effectiveRole = resolveEffectiveRole(
    actualRole,
    cookieStore.get(VIEW_AS_COOKIE)?.value,
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarSwitch
        role={effectiveRole}
        actualRole={actualRole}
        userName={profile?.full_name ?? ""}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
