"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, CircleHelp, Eye, EyeOff, User } from "lucide-react";
import type { UserRole } from "@/lib/auth/profile";
import { isNavItemVisibleForRole, type AppMode } from "@/lib/auth/app-mode";
import { useViewAs } from "@/components/layout/use-view-as";
import {
  activeHref,
  GUIDE_HREF,
  NAV_SECTIONS,
  visibleItems,
  type NavItem,
  type NavSection,
} from "@/lib/nav/sections";

// The sidebar renders lib/nav/sections.ts: six sections, each with its tools.
// What a person sees is filtered by role and deployment; what they can reach
// is decided separately in proxy.ts.

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-[var(--bip-hover)] font-medium text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bip-hover)] hover:text-[var(--text)]"
      }`}
    >
      <Icon size={15} className={active ? "text-[var(--bip-accent)]" : ""} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Section({
  section,
  items,
  more,
  current,
}: {
  section: NavSection;
  items: NavItem[];
  more: NavItem[];
  current: string | null;
}) {
  const moreActive = more.some((item) => item.href === current);
  const [moreOpen, setMoreOpen] = useState(false);
  const SectionIcon = section.icon;
  const open = moreOpen || moreActive;

  return (
    <div>
      <p className="flex items-center gap-2 px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">
        <SectionIcon size={12} aria-hidden="true" />
        {section.label}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={item.href === current} />
        ))}
      </div>
      {more.length > 0 && section.more && (
        <div className="mt-0.5">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={open}
            disabled={moreActive}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[var(--text-subtle)] transition-colors hover:bg-[var(--bip-hover)] hover:text-[var(--text-muted)] disabled:cursor-default disabled:hover:bg-transparent"
          >
            {section.more.label}
            <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
          </button>
          {open && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-[var(--bip-border)] pl-1">
              {more.map((item) => (
                <NavLink key={item.href} item={item} active={item.href === current} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewAsToggle({ previewing }: { previewing: boolean }) {
  const toggle = useViewAs(previewing);
  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        previewing
          ? "bg-[var(--bip-accent)] text-white hover:opacity-90"
          : "text-[var(--text-muted)] hover:bg-[var(--bip-hover)] hover:text-[var(--text)]"
      }`}
    >
      {previewing ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      {previewing ? "Exit strategist view" : "View as strategist"}
    </button>
  );
}

export default function Sidebar({
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
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const previewing = actualRole === "admin" && role !== "admin";
  const canSee = (href: string) => isNavItemVisibleForRole(href, appMode, isAdmin);

  const sections = NAV_SECTIONS.map((section) => ({
    section,
    items: visibleItems(section.items, isAdmin, canSee),
    more: visibleItems(section.more?.items ?? [], isAdmin, canSee),
  })).filter(({ items, more }) => items.length + more.length > 0);

  const current = activeHref(pathname, [
    ...sections.flatMap(({ items, more }) => [...items, ...more]).map((item) => item.href),
    GUIDE_HREF,
  ]);

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-[var(--bip-border)] bg-[var(--bip-card)]">
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--bip-border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bip-accent)]">
          <span className="text-xs font-bold text-bip-text">B</span>
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">BIP Control</span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 pt-4">
        {sections.map(({ section, items, more }) => (
          <Section key={section.key} section={section} items={items} more={more} current={current} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-[var(--bip-border)] p-3">
        <NavLink item={{ label: "Team guide", href: GUIDE_HREF, icon: CircleHelp }} active={current === GUIDE_HREF} />
        {userName && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-subtle)]">
            <User size={13} aria-hidden="true" />
            <span className="truncate">{userName}</span>
            {actualRole === "admin" && !previewing && (
              <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--primary)]">
                Admin
              </span>
            )}
            {previewing && (
              <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--bip-accent)]">
                Strategist view
              </span>
            )}
          </div>
        )}
        {actualRole === "admin" && <ViewAsToggle previewing={previewing} />}
      </div>

      {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA && (
        <div className="px-4 pb-3 font-mono text-[0.6rem] text-[var(--text-subtle)]">
          {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)}
        </div>
      )}
    </aside>
  );
}
