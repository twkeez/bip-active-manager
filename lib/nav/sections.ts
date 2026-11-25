import {
  Activity,
  BarChart3,
  Bird,
  BookOpen,
  Building2,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Crown,
  FileDown,
  FileText,
  Gauge,
  Globe,
  GraduationCap,
  Handshake,
  House,
  Layers,
  LifeBuoy,
  Link2,
  Map,
  MapPin,
  MapPinned,
  MessageSquare,
  MessageSquareQuote,
  Phone,
  Radar,
  ScanSearch,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sunrise,
  TrendingUp,
  Wand2,
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
// Cut tools (Client Briefings, Illuminare, Ads Planner, Social Planner, Wins,
// Sales Lab) have no link. Their pages still answer until they are deleted.

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
      { label: "Daily Brief", href: "/daily-brief", icon: Sunrise, adminOnly: true },
      { label: "Poobah Client Watch", href: "/client-watch", icon: Crown, adminOnly: true },
      { label: "My Tasks", href: "/my-tasks", icon: CheckSquare, adminOnly: true },
      { label: "Assistant", href: "/assistant", icon: Sparkles, adminOnly: true },
      { label: "AI Planner", href: "/ai-planner", icon: Wand2, adminOnly: true },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Building2,
    items: [{ label: "Clients", href: "/dashboard/clients", icon: Building2 }],
    more: {
      label: "Across all clients",
      items: [
        { label: "Ads Health", href: "/ads-health", icon: Gauge },
        { label: "Ads Diagnostic", href: "/ads-diagnostic", icon: Activity, adminOnly: true },
        { label: "Conversion Integrity", href: "/conversion-integrity", icon: Radar },
        { label: "Global Ads Optimization", href: "/global-ads-optimization", icon: Globe },
        { label: "PPC Defense", href: "/ppc-defense", icon: Shield },
        { label: "Ad Cost Trends", href: "/ad-spend-trends", icon: TrendingUp, adminOnly: true },
        { label: "Ad Calls", href: "/ads-calls", icon: Phone, adminOnly: true },
        { label: "SEO Audits", href: "/seo-audits", icon: ClipboardList },
        { label: "Site Audit", href: "/site-audit", icon: Globe },
        { label: "Website & AI Audit", href: "/website-audits", icon: ScanSearch, adminOnly: true },
        { label: "Sitemaps", href: "/sitemaps", icon: Map },
        { label: "Local Grid Rank", href: "/local-rank", icon: MapPinned },
        { label: "Maps Rank Tracker", href: "/maps-rank", icon: MapPin, adminOnly: true },
        { label: "Reputation", href: "/reputation", icon: MessageSquareQuote },
        { label: "llms.txt", href: "/llms-txt", icon: FileText, adminOnly: true },
      ],
    },
  },
  {
    key: "reporting",
    label: "Reporting",
    icon: BarChart3,
    items: [
      { label: "Monthly reports", href: "/reporting", icon: ClipboardCheck },
      { label: "Client Snapshot", href: "/client-snapshot", icon: BarChart3, adminOnly: true },
      { label: "Doc → PDF", href: "/reports/doc-to-pdf", icon: FileDown },
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
      { label: "Best Practices", href: "/best-practices", icon: Sparkles, adminOnly: true },
      { label: "Partnership & Boundaries", href: "/services/partnership", icon: Handshake },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: Settings,
    items: [
      { label: "Team", href: "/team", icon: ShieldCheck, adminOnly: true },
      { label: "Coal Mines", href: "/coal-mines", icon: Bird, adminOnly: true },
      { label: "AI Spend", href: "/ai-spend", icon: Coins, adminOnly: true },
      { label: "Project Wiring", href: "/basecamp-projects", icon: Link2, adminOnly: true },
      { label: "Ads Accounts", href: "/ads-accounts", icon: Link2, adminOnly: true },
      { label: "Bulk Auto-Discover", href: "/bulk-discover", icon: ScanSearch, adminOnly: true },
      { label: "Help Desk Report", href: "/help-desk-report", icon: LifeBuoy, adminOnly: true },
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
