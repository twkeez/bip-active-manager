"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import SidebarRedesign from "@/components/layout/sidebar-redesign";
import type { UserRole } from "@/lib/auth/profile";
import type { AppMode } from "@/lib/auth/app-mode";

/**
 * Both sidebars ship side by side while the redesign is evaluated.
 *
 * The redesigned dark sidebar appears only on the redesigned Clients page;
 * every other route keeps the original. Widening the redesign later is a matter
 * of adding routes to REDESIGNED_ROUTES — or deleting this component and
 * rendering SidebarRedesign directly in the layout.
 */
const REDESIGNED_ROUTES = ["/dashboard/clients"];

/** /dashboard/clients/123 — the redesigned client overview. */
const CLIENT_DETAIL_PATTERN = /^\/dashboard\/clients\/\d+$/;

export default function SidebarSwitch(props: {
  role: UserRole;
  actualRole: UserRole;
  userName: string;
  appMode: AppMode;
}) {
  const pathname = usePathname();
  const useRedesign =
    REDESIGNED_ROUTES.includes(pathname) || CLIENT_DETAIL_PATTERN.test(pathname);

  if (useRedesign) {
    return (
      <SidebarRedesign
        role={props.role}
        actualRole={props.actualRole}
        userName={props.userName}
        appMode={props.appMode}
      />
    );
  }
  return <Sidebar {...props} />;
}
