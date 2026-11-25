import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/sidebar";
import { getProfile } from "@/lib/auth/profile";
import { resolveEffectiveRole, VIEW_AS_COOKIE } from "@/lib/auth/effective-role";
import { getAppMode } from "@/lib/auth/app-mode";
import { readAccess } from "@/lib/auth/access";
import DataWarningBanner from "@/components/data-integrity/data-warning-banner";
import { isActiveWarning, loadOpenWarnings } from "@/lib/data-integrity/warnings";

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

  // Sections an admin granted this person (lib/auth/sections.ts). An admin
  // previewing the strategist view sees a strategist with none. If they can't
  // be read the sidebar shows the plain strategist view; proxy.ts reports the
  // failure on the pages themselves.
  const access = effectiveRole === actualRole ? await readAccess(supabase, user.id) : null;
  const grants = access?.ok ? access.access.grants : [];

  const activeWarnings = (await loadOpenWarnings(supabase)).filter((warning) => isActiveWarning(warning));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={effectiveRole}
        actualRole={actualRole}
        userName={profile?.full_name ?? ""}
        appMode={getAppMode()}
        grants={grants}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <DataWarningBanner warnings={activeWarnings} showLink={getAppMode() === "full"} />
        {children}
      </main>
    </div>
  );
}
