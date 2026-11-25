import {
  BarChart3,
  Bird,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Crown,
  GraduationCap,
  House,
  Layers,
  Link2,
  MessageSquare,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

// THE SIDEBAR. Six sections, in this order, each holding the tools that belong
// to it today. Later redesign phases replace the tools inside a section (for
// example Home becomes one page in phase 5); the sections themselves stay.
//
// The team guide (lib/guide/content.ts) has one section per entry here and one
// entry per link, in the same order; lib/guide/content.test.ts fails when they
// disagree. Access is not decided here: proxy.ts decides what a person can
// reach, and `adminOnly` and lib/auth/app-mode.ts only decide what they see.
//
// Parked and cut tools were removed from the app. The tool inventory and
// restore guide (Claude Doc "BIP Control: tool inventory and restore guide")
// lists each one and how to bring it back from commit d1c45bc.

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only admins see the link. */
  adminOnly?: boolean;
};

export type NavSection = {
  key: "home" | "clients" | "reporting" | "onboarding" | "playbook" | "admin";
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** A second, folded list under the main items, opened when one of its pages is open. */
  more?: { label: string; items: NavItem[] };
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "home",
    label: "Home",
    icon: House,
    items: [
      { label: "Response Report", href: "/response-report", icon: MessageSquare },
      { label: "Poobah Client Watch", href: "/client-watch", icon: Crown, adminOnly: true },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Building2,
    items: [{ label: "Clients", href: "/dashboard/clients", icon: Building2 }],
  },
  {
    key: "reporting",
    label: "Reporting",
    icon: BarChart3,
    items: [
      { label: "Monthly reports", href: "/reporting", icon: ClipboardCheck },
      { label: "Client Snapshot", href: "/client-snapshot", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    key: "onboarding",
    label: "Onboarding",
    icon: GraduationCap,
    items: [{ label: "Onboarding", href: "/onboarding", icon: GraduationCap, adminOnly: true }],
  },
  {
    key: "playbook",
    label: "Playbook",
    icon: BookOpen,
    items: [
      { label: "Services & Tiers", href: "/services", icon: Layers },
      { label: "Service Playbook", href: "/playbook", icon: BookOpen },
      { label: "Client Expectations", href: "/client-expectations", icon: CalendarClock, adminOnly: true },
      { label: "Onboarding Basecamp Message", href: "/onboarding-settings", icon: MessageSquare, adminOnly: true },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: Settings,
    items: [
      { label: "Team", href: "/team", icon: ShieldCheck, adminOnly: true },
      { label: "Coal Mines", href: "/coal-mines", icon: Bird, adminOnly: true },
      { label: "Project Wiring", href: "/basecamp-projects", icon: Link2, adminOnly: true },
    ],
  },
];

/** The team guide's own link, under the sections. */
export const GUIDE_HREF = "/guide";

/** Every link in a section, main items first. */
export function sectionLinks(section: NavSection): NavItem[] {
  return [...section.items, ...(section.more?.items ?? [])];
}

export function allNavLinks(): NavItem[] {
  return NAV_SECTIONS.flatMap(sectionLinks);
}

/** Path-segment prefix match: /services matches /services/x but not /services-x. */
export function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The link to highlight for a path: the longest matching href, so
 * /services/partnership lights Partnership & Boundaries and not Services & Tiers.
 */
export function activeHref(pathname: string, hrefs: string[] = allNavLinks().map((link) => link.href)): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isActiveHref(pathname, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** Which links a person sees: admin-only links for admins, then the deployment and role filter. */
export function visibleItems(
  items: NavItem[],
  isAdmin: boolean,
  isVisible: (href: string) => boolean,
): NavItem[] {
  return items.filter((item) => (!item.adminOnly || isAdmin) && isVisible(item.href));
}
