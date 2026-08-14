"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import SidebarRedesign from "@/components/layout/sidebar-redesign";
import type { UserRole } from "@/lib/auth/profile";

/**
 * Both sidebars ship side by side while the redesign is evaluated.
 *
 * The redesigned dark sidebar appears only on the redesigned Clients page;
 * every other route keeps the original. Widening the redesign later is a matter
 * of adding routes to REDESIGNED_ROUTES — or deleting this component and
 * rendering SidebarRedesign directly in the layout.
 */
const REDESIGNED_ROUTES = ["/dashboard/clients"];

export default function SidebarSwitch(props: {
  role: UserRole;
  actualRole: UserRole;
  userName: string;
}) {
  const pathname = usePathname();
  // Exact match: the client workspace at /dashboard/clients/[id] keeps the
  // original sidebar, since only the list page has been redesigned.
  const useRedesign = REDESIGNED_ROUTES.includes(pathname);

  if (useRedesign) {
    return <SidebarRedesign role={props.role} userName={props.userName} />;
  }
  return <Sidebar {...props} />;
}
