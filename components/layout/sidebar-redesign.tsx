"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CheckSquare,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import type { UserRole } from "@/lib/auth/profile";
import { isNavItemVisible, type AppMode } from "@/lib/auth/app-mode";
import { useViewAs } from "@/components/layout/use-view-as";

// Sidebar from the Clients redesign handoff. Runs alongside the original
// sidebar rather than replacing it — see components/layout/sidebar-switch.tsx.
// Colours are the handoff's literal tokens, so they are written as hex rather
// than pulled from the app's theme variables.

const C = {
  bg: "#17160F",
  text: "#A9A69B",
  muted: "#7A766A",
  bright: "#F5F4EF",
  brand: "#2B3FE4",
  avatarBg: "#3A382C",
  avatarText: "#EDEBE2",
};

type NavItem = { label: string; href: string; icon: React.ElementType; adminOnly?: boolean };

const WORKSPACE: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, adminOnly: true },
  { label: "Control Center", href: "/control-center", icon: Cpu, adminOnly: true },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Onboarding", href: "/onboarding", icon: GraduationCap },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Team", href: "/team", icon: ShieldCheck, adminOnly: true },
];

const GROWTH: NavItem[] = [
  { label: "Strategy Mapper", href: "/onboarding-strategy-mapper", icon: Compass, adminOnly: true },
  { label: "Vet Onboarding", href: "/vet-onboarding", icon: Stethoscope, adminOnly: true },
  { label: "Onboarding Settings", href: "/onboarding-settings", icon: SlidersHorizontal, adminOnly: true },
];

const SUPPORT: NavItem[] = [
  { label: "Services & Tiers", href: "/services", icon: Layers },
  { label: "Service Playbook", href: "/playbook", icon: BookOpen },
  { label: "Onboarding SOPs", href: "/onboarding-sops", icon: GraduationCap, adminOnly: true },
  { label: "Client Expectations", href: "/client-expectations", icon: CalendarClock, adminOnly: true },
];

function NavLink({
  item,
  role,
  appMode,
}: {
  item: NavItem;
  role: UserRole;
  appMode: AppMode;
}) {
  const pathname = usePathname();
  if (item.adminOnly && role !== "admin") return null;
  if (!isNavItemVisible(item.href, appMode)) return null;
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : item.href === "/dashboard/clients"
        ? pathname === "/dashboard/clients"
        : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      style={{
        color: active ? C.bright : C.text,
        background: active ? "rgba(255,255,255,0.09)" : undefined,
      }}
      className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[6.5px] text-[12.5px] font-semibold transition-colors duration-150 hover:bg-white/[0.06] hover:!text-[#D9D5C9]"
    >
      <Icon size={15} strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

function Section({
  label,
  items,
  role,
  appMode,
}: {
  label: string;
  items: NavItem[];
  role: UserRole;
  appMode: AppMode;
}) {
  const visible = items.filter(
    (i) => (!i.adminOnly || role === "admin") && isNavItemVisible(i.href, appMode),
  );
  if (visible.length === 0) return null;
  return (
    <div>
      <p
        style={{ color: C.muted, letterSpacing: "0.09em" }}
        className="mb-[5px] mt-3.5 px-2.5 text-[10px] font-bold uppercase"
      >
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} role={role} appMode={appMode} />
        ))}
      </div>
    </div>
  );
}

function ViewAsToggle({ previewing }: { previewing: boolean }) {
  const toggle = useViewAs(previewing);

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        color: previewing ? "#FFFFFF" : C.text,
        background: previewing ? C.brand : "rgba(255,255,255,0.06)",
      }}
      className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[6.5px] text-[12px] font-semibold transition-colors duration-150 hover:opacity-90"
    >
      {previewing ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
      {previewing ? "Exit team view" : "View as team"}
    </button>
  );
}

export default function SidebarRedesign({
  role,
  actualRole,
  userName,
  appMode,
}: {
  role: UserRole;
  actualRole: UserRole;
  userName: string;
  appMode: AppMode;
}) {
  const previewing = actualRole === "admin" && role !== "admin";
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <aside
      style={{ background: C.bg }}
      className="flex h-screen w-[228px] flex-shrink-0 flex-col"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pb-1 pt-4">
        <div
          style={{ background: C.brand }}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg"
        >
          <SlidersHorizontal size={14} strokeWidth={2} className="text-white" />
        </div>
        <div className="leading-tight">
          <p style={{ color: C.bright }} className="text-[15px] font-semibold">
            BIP Control
          </p>
          <p
            style={{ color: C.muted, letterSpacing: "0.12em" }}
            className="text-[9px] font-semibold uppercase"
          >
            Agency Operations
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <Section label="Workspace" items={WORKSPACE} role={role} appMode={appMode} />
        <Section label="Growth" items={GROWTH} role={role} appMode={appMode} />
        <Section label="Support" items={SUPPORT} role={role} appMode={appMode} />
      </nav>

      {/* Footer */}
      {actualRole === "admin" && (
        <div className="px-3 pb-1">
          <ViewAsToggle previewing={previewing} />
        </div>
      )}
      <div
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
        className="flex items-center gap-2.5 border-t px-4 py-3"
      >
        <div
          style={{ background: C.avatarBg, color: C.avatarText }}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p style={{ color: C.avatarText }} className="truncate text-[12.5px] font-semibold">
            {userName || "Signed in"}
          </p>
          <p
            style={{ color: previewing ? C.brand : C.muted }}
            className="text-[10.5px]"
          >
            {previewing
              ? "Team view"
              : role === "admin"
                ? "Admin"
                : "Strategist"}
          </p>
        </div>
        <Bell size={15} strokeWidth={1.8} style={{ color: C.muted }} className="shrink-0" />
      </div>
    </aside>
  );
}
