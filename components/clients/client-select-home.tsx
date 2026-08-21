"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  LayoutGrid,
  MessageSquare,
  Rows3,
  Search,
} from "lucide-react";
import type { ClientListInitialData } from "@/lib/dashboard/load-client-list-data";
import { getClientActiveServices, isWebsiteOnly } from "@/lib/clients/service-active";
import { shouldShowReplyAlert } from "@/lib/clients/acknowledge-no-reply";
import {
  CLIENT_LIST_PATH,
  writeStoredClientListHref,
} from "@/lib/clients/client-list-view-state";
import type { ClientRow } from "@/lib/types/client";
import type { SignalSummary } from "@/lib/dashboard/snapshot-queries";

type Filter = "all" | "attention" | "active" | "onboarding";
type ViewMode = "grid" | "table";

const TABLE_DEFAULT_THRESHOLD = 20;

const SERVICE_LABELS: Record<string, string> = {
  seo: "SEO",
  ppc: "PPC",
  smm: "Social",
  orm: "ORM",
};

function activeServices(client: ClientRow): string[] {
  const active = getClientActiveServices(client);
  return Object.entries(active)
    .filter(([, v]) => v)
    .map(([k]) => SERVICE_LABELS[k] ?? k.toUpperCase());
}

function daysAgoLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function syncAgeLabel(value: string | null | undefined): { label: string; stale: boolean } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  const abs = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  let rel: string;
  if (mins < 1) rel = "just now";
  else if (mins < 60) rel = `${mins}m ago`;
  else if (mins < 60 * 24) rel = `${Math.floor(mins / 60)}h ago`;
  else rel = `${Math.floor(mins / (60 * 24))}d ago`;
  return { label: `${abs} (${rel})`, stale: mins >= 60 * 12 };
}

function hasCriticalSignal(
  clientId: number,
  gsc: Record<number, SignalSummary>,
  ads: Record<number, SignalSummary>,
): boolean {
  return !!(gsc[clientId]?.hasCritical || ads[clientId]?.hasCritical);
}

type RowStatus = "needs_reply" | "alert" | "onboarding" | "ok";

function rowStatus(
  client: ClientRow,
  gsc: Record<number, SignalSummary>,
  ads: Record<number, SignalSummary>,
): RowStatus {
  if (shouldShowReplyAlert(client)) return "needs_reply";
  if (hasCriticalSignal(client.id, gsc, ads)) return "alert";
  if (client.onboarding_status === "active") return "onboarding";
  return "ok";
}

const STATUS_BADGE: Record<RowStatus, { label: string; className: string; icon: React.ElementType }> = {
  needs_reply: {
    label: "Needs reply",
    className: "bg-red-50 text-red-700 border-red-200/60",
    icon: MessageSquare,
  },
  alert: {
    label: "Alerts",
    className: "bg-amber-50 text-amber-700 border-amber-200/60",
    icon: AlertTriangle,
  },
  onboarding: {
    label: "Onboarding",
    className: "bg-sky-50 text-sky-700 border-sky-200/60",
    icon: Clock,
  },
  ok: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    icon: CheckCircle2,
  },
};

function StatusBadge({ status, daysStale }: { status: RowStatus; daysStale?: number | null }) {
  const { label, className, icon: Icon } = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      <Icon size={11} />
      {status === "needs_reply" && daysStale != null ? `${daysStale}d unanswered` : label}
    </span>
  );
}

function HoursBar({ client }: { client: ClientRow }) {
  const pkg = client.total_package_hours ?? 0;
  const used = client.hours_for_strategist ?? 0;
  if (pkg <= 0) return <span className="text-xs font-medium text-slate-400">—</span>;
  const pct = Math.min(100, (used / pkg) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${pct >= 100 ? "bg-gradient-to-r from-amber-400 to-red-400" : "bg-gradient-to-r from-indigo-500 to-violet-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs font-medium text-slate-500">
        {used}/{pkg}
      </span>
    </div>
  );
}

const FILTER_PARAM_VALUES = new Set<Filter>(["all", "attention", "active", "onboarding"]);

export default function ClientSelectHome({
  clients,
  gscSignalSummariesByClient,
  adsSignalSummariesByClient,
  threadPreviews,
  syncState,
}: ClientListInitialData) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [strategist, setStrategist] = useState<string>("all");
  const [showWebsiteOnly, setShowWebsiteOnly] = useState(false);
  const [view, setView] = useState<ViewMode | null>(null); // null = auto
  const [hydrated, setHydrated] = useState(false);

  // Restore view state: URL params win, else the stored href from this session.
  useEffect(() => {
    try {
      let params = new URLSearchParams(window.location.search);
      if (![...params.keys()].length) {
        const stored = window.sessionStorage.getItem("bip:client-list-view") ?? "";
        const qi = stored.indexOf("?");
        if (qi !== -1) params = new URLSearchParams(stored.slice(qi + 1));
      }
      const q = params.get("q");
      const flt = params.get("flt") as Filter | null;
      const strat = params.get("strategist");
      const v = params.get("view");
      if (q) setQuery(q);
      if (flt && FILTER_PARAM_VALUES.has(flt)) setFilter(flt);
      if (strat) setStrategist(strat);
      if (v === "grid" || v === "table") setView(v);
    } catch {
      // Ignore restore failures.
    }
    setHydrated(true);
  }, []);

  // Persist view state so the workspace "Back to clients" link restores it.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filter !== "all") params.set("flt", filter);
    if (strategist !== "all") params.set("strategist", strategist);
    if (view) params.set("view", view);
    const qs = params.toString();
    writeStoredClientListHref(qs ? `${CLIENT_LIST_PATH}?${qs}` : CLIENT_LIST_PATH);
  }, [hydrated, query, filter, strategist, view]);

  const strategistOptions = useMemo(() => {
    const vals = new Set(clients.map((c) => c.marketing_strategist ?? "").filter(Boolean));
    return Array.from(vals).sort();
  }, [clients]);

  const threadByProject = useMemo(() => {
    const map = new Map<string, (typeof threadPreviews)[0]>();
    for (const t of threadPreviews) {
      if (!map.has(t.basecamp_project_id)) map.set(t.basecamp_project_id, t);
    }
    return map;
  }, [threadPreviews]);

  const enriched = useMemo(
    () =>
      clients.map((c) => ({
        client: c,
        status: rowStatus(c, gscSignalSummariesByClient, adsSignalSummariesByClient),
        services: activeServices(c),
        lastThread: c.basecamp_project_id
          ? threadByProject.get(c.basecamp_project_id) ?? null
          : null,
      })),
    [clients, gscSignalSummariesByClient, adsSignalSummariesByClient, threadByProject],
  );

  const activeClients = useMemo(
    () => enriched.filter((r) => !isWebsiteOnly(r.client)),
    [enriched],
  );

  // "Needs Attention Today" shelf — unanswered client threads only (acknowledging
  // "No reply needed" clears the flag, which removes the client from the shelf).
  const attentionShelf = useMemo(
    () =>
      activeClients
        .filter((r) => r.status === "needs_reply")
        .sort((a, b) => (b.client.days_stale ?? 0) - (a.client.days_stale ?? 0)),
    [activeClients],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return enriched
      .filter(({ client, status, services }) => {
        const websiteOnly = isWebsiteOnly(client);
        if (!showWebsiteOnly && websiteOnly) return false;
        if (q) {
          const haystack = [
            client.account_name ?? "",
            client.marketing_strategist ?? "",
            client.tier ?? "",
            ...services,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (strategist !== "all" && (client.marketing_strategist ?? "") !== strategist) return false;
        if (filter === "attention") return status === "needs_reply" || status === "alert";
        if (filter === "active") return status === "ok";
        if (filter === "onboarding") return status === "onboarding";
        return true;
      })
      .sort((a, b) =>
        (a.client.account_name ?? "").localeCompare(b.client.account_name ?? ""),
      );
  }, [enriched, query, filter, strategist, showWebsiteOnly]);

  const counts = useMemo(
    () => ({
      attention: activeClients.filter((r) => r.status === "needs_reply" || r.status === "alert").length,
      active: activeClients.filter((r) => r.status === "ok").length,
      onboarding: activeClients.filter((r) => r.status === "onboarding").length,
      website_only: enriched.filter((r) => isWebsiteOnly(r.client)).length,
    }),
    [enriched, activeClients],
  );

  const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All", count: activeClients.length },
    { id: "attention", label: "Needs Attention", count: counts.attention },
    { id: "active", label: "Active", count: counts.active },
    { id: "onboarding", label: "Onboarding", count: counts.onboarding },
  ];

  const effectiveView: ViewMode =
    view ?? (activeClients.length >= TABLE_DEFAULT_THRESHOLD ? "table" : "grid");

  const sync = syncAgeLabel(syncState?.last_synced_at);

  return (
    <div className="min-h-full bg-slate-50/50">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-8 pt-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Beyond Indigo · Client Hub
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Who are we helping today?
        </h1>
        <div className="mt-5 h-1.5 w-28 rounded-full bg-gradient-to-r from-lime-300 via-sky-400 to-pink-400" />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-medium text-slate-500">
            {activeClients.length} active clients
            {counts.attention > 0 && ` · ${counts.attention} need attention`}
          </p>
          {sync && (
            <p className={`text-xs font-medium ${sync.stale ? "text-amber-600" : "text-slate-400"}`}>
              Basecamp synced {sync.label}
              {sync.stale && " — consider refreshing"}
            </p>
          )}
        </div>

        {/* Needs Attention Today shelf */}
        {attentionShelf.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold tracking-tight text-slate-900">
              Needs Attention Today
              <span className="ml-2 text-xs font-medium text-slate-400">
                {attentionShelf.length} unanswered thread{attentionShelf.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
              {attentionShelf.map(({ client, lastThread }) => {
                const urgent = (client.days_stale ?? 0) >= 14;
                return (
                  <Link
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className={`group w-72 shrink-0 rounded-2xl border bg-white p-4 shadow-sm ring-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      urgent
                        ? "border-red-200/80 ring-red-100"
                        : "border-amber-200/80 ring-amber-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {client.account_name}
                      </p>
                      <ArrowUpRight
                        size={14}
                        className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-slate-900"
                      />
                    </div>
                    <p
                      className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-red-600" : "text-amber-600"}`}
                    >
                      <MessageSquare size={11} />
                      {client.days_stale != null
                        ? `${client.days_stale}d unanswered`
                        : "Awaiting reply"}
                    </p>
                    {lastThread?.thread_excerpt && (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                        &ldquo;{lastThread.thread_excerpt}&rdquo;
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sticky control toolbar */}
      <div className="sticky top-0 z-10 mt-6 border-b border-slate-200/80 bg-slate-50/80 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-8">
          <div className="relative min-w-56 flex-1 md:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, tags, or strategists..."
              className="w-full rounded-full border border-slate-200/80 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
            />
          </div>
          <select
            value={strategist}
            onChange={(e) => setStrategist(e.target.value)}
            className="rounded-full border border-slate-200/80 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none"
          >
            <option value="all">All strategists</option>
            {strategistOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200/80 bg-white text-slate-500 shadow-sm hover:border-slate-400 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 tabular-nums ${active ? "opacity-60" : "text-slate-400"}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center rounded-full border border-slate-200/80 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setView("grid")}
              title="Grid view"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                effectiveView === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={13} />
              Grid
            </button>
            <button
              onClick={() => setView("table")}
              title="Table view"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                effectiveView === "table" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Rows3 size={13} />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-8 pb-12 pt-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No clients match.</p>
          </div>
        ) : effectiveView === "grid" ? (
          /* ── Grid view ── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(({ client, status, services, lastThread }) => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="group flex h-44 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{client.account_name}</p>
                    {client.marketing_strategist && (
                      <p className="mt-0.5 text-xs font-medium text-slate-400">
                        {client.marketing_strategist}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={status} daysStale={client.days_stale} />
                </div>
                <div className="mt-auto space-y-2.5">
                  <HoursBar client={client} />
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {services.map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/80 text-slate-400 transition group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                      <ArrowRight size={13} />
                    </span>
                  </div>
                  {lastThread?.occurred_at && (
                    <p className="truncate text-[0.7rem] font-medium text-slate-400">
                      Last message {daysAgoLabel(lastThread.occurred_at)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* ── Table view ── */
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Client</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:table-cell">Services</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hours</th>
                  <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 lg:table-cell">Last message</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(({ client, status, services, lastThread }) => (
                  <tr key={client.id} className="group transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/clients/${client.id}`} className="block">
                        <p className="text-sm font-semibold text-slate-900">{client.account_name}</p>
                        {client.marketing_strategist && (
                          <p className="text-xs font-medium text-slate-400">{client.marketing_strategist}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} daysStale={client.days_stale} />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {services.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <HoursBar client={client} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs font-medium text-slate-500 lg:table-cell">
                      {lastThread?.occurred_at ? daysAgoLabel(lastThread.occurred_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-900 hover:text-slate-900"
                        >
                          View
                        </Link>
                        {client.basecamp_project_id && (
                          <a
                            href={`https://basecamp.com/2175055/projects/${client.basecamp_project_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in Basecamp"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-400 shadow-sm transition hover:border-slate-900 hover:text-slate-900"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Website-only toggle */}
        {counts.website_only > 0 && (
          <button
            onClick={() => setShowWebsiteOnly((v) => !v)}
            className="mt-6 text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {showWebsiteOnly ? "Hide" : "Show"} {counts.website_only} website-only clients
          </button>
        )}
      </div>
    </div>
  );
}
