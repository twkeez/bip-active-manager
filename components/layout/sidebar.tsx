"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Flame,
  Globe,
  LayoutDashboard,
  Map,
  MapPinned,
  Megaphone,
  MessageSquare,
  Moon,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
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
  { label: "Comms Monitor", href: "/dashboard/comms", icon: MessageSquare },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
];

const TOOLS: NavItem[] = [
  { label: "Service Playbook", href: "/playbook", icon: BookOpen },
  { label: "Bulk Auto-Discover", href: "/bulk-discover", icon: ScanSearch, adminOnly: true },
  { label: "Sitemaps", href: "/sitemaps", icon: Map },
  { label: "SEO Ops", href: "/seo-ops", icon: ClipboardCheck },
  { label: "Site Audit", href: "/site-audit", icon: Globe },
  { label: "Local Grid Rank", href: "/local-rank", icon: MapPinned },
  { label: "Global Ads", href: "/global-ads-optimization", icon: Megaphone },
  { label: "PPC Defense", href: "/ppc-defense", icon: Flame },
  { label: "Conversion Radar", href: "/conversion-integrity", icon: ShieldAlert },
  { label: "Ads Audit", href: "/ads-audit/", icon: Megaphone },
  { label: "Report Template", href: "/reports/template", icon: FileText, adminOnly: true },
  { label: "Doc → PDF", href: "/reports/doc-to-pdf", icon: FileDown },
  { label: "llms.txt", href: "/llms-txt", icon: FileText, adminOnly: true },
];

const SALES: NavItem[] = [
  { label: "Sales Lab", href: "/sales-lab", icon: Sparkles, adminOnly: true },
  { label: "Strategy Mapper", href: "/onboarding-strategy-mapper", icon: Compass, adminOnly: true },
  { label: "Vet Onboarding", href: "/vet-onboarding", icon: Stethoscope, adminOnly: true },
];

// The trimmed navigation non-admin users (strategists) see.
const USER_NAV: NavItem[] = [
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Reporting", href: "/reports/doc-to-pdf", icon: FileDown },
];

function NavLink({ item, role }: { item: NavItem; role: UserRole }) {
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
      <Icon size={15} className={active ? "text-[var(--bip-accent)]" : ""} />
      {item.label}
    </Link>
  );
}

function SectionGroup({
  label,
  items,
  role,
  defaultOpen = true,
}: {
  label: string;
  items: NavItem[];
  role: UserRole;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = items.filter((i) => !i.adminOnly || role === "admin");
  if (visible.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition-colors"
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
            <NavLink key={item.href} item={item} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("bip-theme");
    const prefersDark = !saved || saved !== "light";
    document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
    setDark(prefersDark);
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("bip-theme", next);
    setDark(!dark);
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-[var(--text-muted)] hover:bg-[var(--bip-hover)] hover:text-[var(--text)]"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
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

            <SectionGroup label="Tools" items={TOOLS} role={role} />

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
        <ThemeToggle />
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
