"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Compass,
  ExternalLink,
  LayoutGrid,
  ListTodo,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { getModuleById, MODULE_GROUPS } from "@/lib/navigation/modules";
import AppHeaderActions from "@/components/layout/app-header-actions";
import BasecampStatusBanners from "@/components/layout/basecamp-status-banners";
import HarvestTimePanel from "@/components/dashboard/harvest-time-panel";
import PriorityTasksPanel from "@/components/dashboard/priority-tasks-panel";
import type { PriorityTask } from "@/lib/tasks/priority-tasks";
import type { BasecampSyncState } from "@/lib/types/client";
type ControlPanelProps = {
  userEmail?: string;
  clientCount: number;
  syncState: BasecampSyncState | null;
  basecampStatus?: string;
  priorityTasks: PriorityTask[];
};
const QUICK_ACCESS = [
  {
    label: "Open Clients",
    href: "/dashboard/clients",
    icon: Building2,
    className: "text-bip-accent",
  },
  {
    label: "New Onboarding",
    href: "/vet-onboarding",
    icon: Stethoscope,
    className: "text-bip-accent",
  },
  {
    label: "Strategy Mapper",
    href: "/onboarding-strategy-mapper",
    icon: Compass,
    className: "text-bip-accent",
  },
  {
    label: "My Tasks",
    href: "/my-tasks",
    icon: ListTodo,
    className: "text-bip-accent",
  },
] as const;
export default function ControlPanel({
  userEmail,
  clientCount,
  syncState,
  basecampStatus,
  priorityTasks,
}: ControlPanelProps) {
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  return (
    <div className="min-h-screen bg-bip-page font-sans text-white">
      <header className="border-b border-white/[0.08] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="text-bip-accent" size={20} />              <h1 className="text-lg font-semibold tracking-tight">
                BIP Control Panel
              </h1>            </div>            <p className="mt-1 text-xs text-white/50">
              Launch modules · {userEmail ?? "Signed in"}            </p>          </div>          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
              {clientCount} client{clientCount === 1 ? "" : "s"}            </span>            <AppHeaderActions
              onSyncComplete={() => setSyncMessage("Basecamp sync completed.")}
            />          </div>        </div>      </header>      <main className="mx-auto max-w-6xl px-6 py-6">
        <BasecampStatusBanners
          basecampStatus={basecampStatus}
          syncState={syncState}
          syncSuccess={syncMessage}
        />        <PriorityTasksPanel tasks={priorityTasks} />        <nav
          aria-label="Quick access"
          className="mb-8 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card/80 px-3 py-2"
        >
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Quick access          </span>          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-bip-page px-2.5 py-1.5 text-xs font-medium text-white/75 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-bip-card hover:text-white hover:shadow-md hover:shadow-black/20"
              >
                <Icon size={14} className={item.className} /> {item.label}              </Link>
            );
          })}        </nav>        <div className="space-y-8">
          {MODULE_GROUPS.map((group, index) => {
            const modules = group.moduleIds
              .map((id) => getModuleById(id))
              .filter((module): module is NonNullable<typeof module> =>
                Boolean(module),
              );
            if (modules.length === 0) return null;
            return (
              <section key={group.id}>
                {index > 0 ? (
                  <hr className="mb-8 border-white/[0.08]" />
                ) : null}                <div className={`border-l-2 pl-4 ${group.borderClass}`}>
                  <h2
                    className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${group.labelClass}`}
                  >
                    {group.label}                  </h2>                  <div
                    className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${group.id === "client-work" ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}
                  >
                    {modules.map((module) => {
                      const Icon = module.icon;
                      const isPrimary = module.featured;
                      return (
                        <Link
                          key={module.id}
                          href={module.href}
                          className={`group rounded-xl border bg-bip-card p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 ${module.accent} ${isPrimary ? "sm:col-span-2 lg:col-span-2 ring-1 ring-bip-accent/30" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`rounded-lg bg-bip-card/70 p-2.5 ${module.iconClass} ${isPrimary ? "p-3" : ""}`}
                            >
                              <Icon size={isPrimary ? 20 : 18} />                            </div>                            {isPrimary ? (
                              <span className="rounded-full bg-bip-accent/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bip-accent">
                                Primary                              </span>
                            ) : (
                              <ExternalLink
                                size={14}
                                className="shrink-0 text-slate-600 transition group-hover:text-white/50"
                              />
                            )}                          </div>                          <h3
                            className={`mt-4 font-semibold text-white ${isPrimary ? "text-base" : "text-sm"}`}
                          >
                            {module.label}                          </h3>                          <p
                            className={`mt-1 leading-relaxed text-white/50 ${isPrimary ? "text-sm" : "text-xs"}`}
                          >
                            {module.description}                          </p>                          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-bip-accent transition group-hover:text-bip-accent">
                            Open module <ArrowRight size={12} />                          </span>                        </Link>
                      );
                    })}                  </div>                </div>              </section>
            );
          })}        </div>        <section className="mt-10 border-t border-white/[0.08] pt-6">
          <button
            type="button"
            onClick={() => setAdminOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-bip-card/60 px-4 py-3 text-left transition hover:bg-bip-card"
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              <Wrench size={14} className="text-slate-600" /> Admin Tools            </span>            <ChevronDown
              size={16}
              className={`text-white/50 transition ${adminOpen ? "rotate-180" : ""}`}
            />          </button>          {adminOpen ? (
            <div className="mt-4">
              <HarvestTimePanel embedded />            </div>
          ) : null}        </section>      </main>    </div>
  );
}
