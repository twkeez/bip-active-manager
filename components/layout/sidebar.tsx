"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  FolderOpen,
  Gauge,
  Globe,
  GraduationCap,
  Handshake,
  Layers,
  LayoutDashboard,
  Link2,
  Map,
  MapPinned,
  Phone,
  Radar,
  ScanSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Trophy,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { UserRole } from "@/lib/auth/profile";
import { VIEW_AS_COOKIE } from "@/lib/auth/effective-role";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const PRIMARY: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Control Center", href: "/control-center", icon: Cpu, adminOnly: true },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Onboarding", href: "/onboarding", icon: GraduationCap },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Team", href: "/team", icon: ShieldCheck, adminOnly: true },
  { label: "Cockpit", href: "/dashboard/cockpit", icon: Zap, adminOnly: true },
];

// Brand magenta — makes the Services section stand out from the indigo nav.
const SERVICES_ACCENT = "#ce2084";

// Amber/gold — sets the Illuminare portfolio apart as its own section.
const ILLUMINARE_ACCENT = "#e0a82e";

// Azure blue — groups the Google Ads tools into their own section.
const ADS_ACCENT = "#2f9bef";

const ILLUMINARE: NavItem[] = [
  { label: "Clients", href: "/illuminare", icon: Building2 },
];

const SERVICES: NavItem[] = [
  { label: "Services & Tiers", href: "/services", icon: Layers },
  { label: "Service Playbook", href: "/playbook", icon: BookOpen },
  { label: "Onboarding SOPs", href: "/onboarding-sops", icon: GraduationCap },
  { label: "Client Expectations", href: "/client-expectations", icon: CalendarClock },
  { label: "Best Practices", href: "/best-practices", icon: Sparkles },
  { label: "Partnership & Boundaries", href: "/services/partnership", icon: Handshake },
  { label: "Reference Library", href: "/services/library", icon: FolderOpen },
];

const ADS: NavItem[] = [
  { label: "Ads Health", href: "/ads-health", icon: Gauge },
  { label: "Ads Diagnostic", href: "/ads-diagnostic", icon: Activity, adminOnly: true },
  { label: "Conversion Integrity", href: "/conversion-integrity", icon: Radar },
  { label: "Ads Planner", href: "/ads-planner", icon: Target, adminOnly: true },
  { label: "Global Ads Optimization", href: "/global-ads-optimization", icon: Globe },
  { label: "PPC Defense", href: "/ppc-defense", icon: Shield },
  { label: "Ad Cost Trends", href: "/ad-spend-trends", icon: TrendingUp, adminOnly: true },
  { label: "Ad Calls", href: "/ads-calls", icon: Phone, adminOnly: true },
];

// Supporting onboarding tools + config, gathered from Sales and Tools where they
// were mis-filed. The main Onboarding queue/wizard stays in Primary.
const ONBOARDING: NavItem[] = [
  { label: "Strategy Mapper", href: "/onboarding-strategy-mapper", icon: Compass, adminOnly: true },
  { label: "Vet Onboarding", href: "/vet-onboarding", icon: Stethoscope, adminOnly: true },
  { label: "Onboarding Settings", href: "/onboarding-settings", icon: ClipboardList, adminOnly: true },
];

const TOOLS: NavItem[] = [
  { label: "AI Planner", href: "/ai-planner", icon: Wand2, adminOnly: true },
  { label: "Social Planner", href: "/social-planner", icon: CalendarDays },
  { label: "Wins", href: "/wins", icon: Trophy, adminOnly: true },
  { label: "Report Template", href: "/reports/template", icon: FileText, adminOnly: true },
  { label: "Doc → PDF", href: "/reports/doc-to-pdf", icon: FileDown },
];

const SEO_TOOLS: NavItem[] = [
  { label: "SEO Audits", href: "/seo-audits", icon: ClipboardList },
  { label: "Sitemaps", href: "/sitemaps", icon: Map },
  { label: "SEO Ops", href: "/seo-ops", icon: ClipboardCheck },
  { label: "Site Audit", href: "/site-audit", icon: Globe },
  { label: "Local Grid Rank", href: "/local-rank", icon: MapPinned },
  { label: "Backlinks", href: "/backlinks", icon: Link2 },
  { label: "llms.txt", href: "/llms-txt", icon: FileText, adminOnly: true },
];

const UTILITIES: NavItem[] = [
  { label: "Bulk Auto-Discover", href: "/bulk-discover", icon: ScanSearch, adminOnly: true },
];

const SALES: NavItem[] = [
  { label: "Sales Lab", href: "/sales-lab", icon: Sparkles, adminOnly: true },
];

// The trimmed navigation non-admin users (strategists) see.
const USER_NAV: NavItem[] = [
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Onboarding", href: "/onboarding", icon: GraduationCap },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Social Planner", href: "/social-planner", icon: CalendarDays },
  { label: "Reporting", href: "/reports/doc-to-pdf", icon: FileDown },
];

function NavLink({ item, role, accentColor }: { item: NavItem; role: UserRole; accentColor?: string }) {
  const pathname = usePathname();
  if (item.adminOnly && role !== "admin") return null;
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[var(--bip-hover)] text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bip-hover)] hover:text-[var(--text)]"
      }`}
    >
      <Icon
        size={15}
        className={active && !accentColor ? "text-[var(--bip-accent)]" : ""}
        style={accentColor ? { color: accentColor } : undefined}
      />
      {item.label}
    </Link>
  );
}

function SectionGroup({
  label,
  items,
  role,
  defaultOpen = true,
  accentColor,
}: {
  label: string;
  items: NavItem[];
  role: UserRole;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = items.filter((i) => !i.adminOnly || role === "admin");
  if (visible.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition-colors"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {label}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {items.map((item) => (
            <NavLink key={item.href} item={item} role={role} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  );
}


function ViewAsToggle({ previewing }: { previewing: boolean }) {
  const router = useRouter();

  function toggle() {
    if (previewing) {
      document.cookie = `${VIEW_AS_COOKIE}=; path=/; max-age=0`;
    } else {
      document.cookie = `${VIEW_AS_COOKIE}=strategist; path=/; max-age=86400`;
    }
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        previewing
          ? "bg-[var(--bip-accent)] text-white hover:opacity-90"
          : "text-[var(--text-muted)] hover:bg-[var(--bip-hover)] hover:text-[var(--text)]"
      }`}
    >
      {previewing ? <EyeOff size={15} /> : <Eye size={15} />}
      {previewing ? "Exit user view" : "View as user"}
    </button>
  );
}

export default function Sidebar({
  role,
  actualRole,
  userName,
}: {
  role: UserRole;
  actualRole: UserRole;
  userName: string;
}) {
  const isUserView = role !== "admin";
  const previewing = actualRole === "admin" && role !== "admin";

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-[var(--bip-border)] bg-[var(--bip-card)]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--bip-border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bip-accent)]">
          <span className="text-xs font-bold text-bip-text">B</span>
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">BIP Control</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 pt-4">
        {isUserView ? (
          <div className="flex flex-col gap-0.5">
            {USER_NAV.map((item) => (
              <NavLink key={item.href} item={item} role={role} />
            ))}
          </div>
        ) : (
          <>
            {/* Primary */}
            <div className="flex flex-col gap-0.5">
              {PRIMARY.map((item) => (
                <NavLink key={item.href} item={item} role={role} />
              ))}
            </div>

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Illuminare" items={ILLUMINARE} role={role} accentColor={ILLUMINARE_ACCENT} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Onboarding" items={ONBOARDING} role={role} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Services" items={SERVICES} role={role} accentColor={SERVICES_ACCENT} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Ads" items={ADS} role={role} accentColor={ADS_ACCENT} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Tools" items={TOOLS} role={role} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="SEO" items={SEO_TOOLS} role={role} defaultOpen={false} />

            <SectionGroup label="Utilities" items={UTILITIES} role={role} defaultOpen={false} />

            <div className="border-t border-[var(--bip-border)]" />

            <SectionGroup label="Sales" items={SALES} role={role} defaultOpen={false} />
          </>
        )}
      </nav>

      {/* User + theme */}
      <div className="border-t border-[var(--bip-border)] p-3 flex flex-col gap-1">
        {userName && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-subtle)]">
            <User size={13} />
            <span>{userName}</span>
            {actualRole === "admin" && !previewing && (
              <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--primary)]">
                Admin
              </span>
            )}
            {previewing && (
              <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--bip-accent)]">
                User view
              </span>
            )}
          </div>
        )}
        {actualRole === "admin" && <ViewAsToggle previewing={previewing} />}
      </div>

      {/* Build stamp */}
      {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && (
        <div className="px-4 pb-3 text-[0.6rem] text-[var(--text-subtle)] font-mono">
          {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}
        </div>
      )}
    </aside>
  );
}
