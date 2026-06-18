"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileText,
  Flame,
  Globe,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  MessageSquare,
  Moon,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const PRIMARY: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Comms Monitor", href: "/dashboard/comms", icon: MessageSquare },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
];

const TOOLS: NavItem[] = [
  { label: "Service Playbook", href: "/playbook", icon: BookOpen },
  { label: "SEO Ops", href: "/seo-ops", icon: ClipboardCheck },
  { label: "Site Audit", href: "/site-audit", icon: Globe },
  { label: "Local Grid Rank", href: "/local-rank", icon: MapPinned },
  { label: "Global Ads", href: "/global-ads-optimization", icon: Megaphone },
  { label: "PPC Defense", href: "/ppc-defense", icon: Flame },
  { label: "Conversion Radar", href: "/conversion-integrity", icon: ShieldAlert },
  { label: "Ads Audit", href: "/ads-audit/", icon: Megaphone },
  { label: "llms.txt", href: "/llms-txt", icon: FileText },
];

const SALES: NavItem[] = [
  { label: "Sales Lab", href: "/sales-lab", icon: Sparkles },
  { label: "Strategy Mapper", href: "/onboarding-strategy-mapper", icon: Compass },
  { label: "Vet Onboarding", href: "/vet-onboarding", icon: Stethoscope },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
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
  defaultOpen = true,
}: {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setDark(current !== "light");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
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

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-[var(--bip-border)] bg-[var(--bip-card)]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--bip-border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bip-accent)]">
          <span className="text-xs font-bold text-white">B</span>
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">BIP Control</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 pt-4">
        {/* Primary */}
        <div className="flex flex-col gap-0.5">
          {PRIMARY.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="border-t border-[var(--bip-border)]" />

        <SectionGroup label="Tools" items={TOOLS} />

        <div className="border-t border-[var(--bip-border)]" />

        <SectionGroup label="Sales" items={SALES} defaultOpen={false} />
      </nav>

      {/* Theme toggle */}
      <div className="border-t border-[var(--bip-border)] p-3">
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
