"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
} from "lucide-react";
import type { ClientListInitialData } from "@/lib/dashboard/load-client-list-data";
import { getClientActiveServices } from "@/lib/clients/service-active";
import { shouldShowReplyAlert } from "@/lib/clients/acknowledge-no-reply";
import {
  CLIENT_LIST_PATH,
  writeStoredClientListHref,
} from "@/lib/clients/client-list-view-state";
import type { ClientRow } from "@/lib/types/client";
import type { SignalSummary } from "@/lib/dashboard/snapshot-queries";

type Filter = "all" | "needs_reply" | "alerts" | "onboarding";

const WEBSITE_ONLY_TIER = "Website Only";

const SERVICE_LABELS: Record<string, string> = {
  seo: "SEO",
  ppc: "PPC",
  smm: "Social",
  orm: "ORM",
};

// Gradient accents in the lime → sky → pink family (design inspiration).
const STATUS_ACCENT: Record<RowStatus, string> = {
  needs_reply: "bg-gradient-to-r from-rose-400 to-pink-500",
  alert: "bg-gradient-to-r from-amber-300 to-pink-400",
  onboarding: "bg-gradient-to-r from-lime-300 to-sky-400",
  ok: "bg-bip-border",
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

function StatusLine({ status, client }: { status: RowStatus; client: ClientRow }) {
  if (status === "needs_reply")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-rose-500">
        <MessageSquare size={12} />
        {client.days_stale != null ? `${client.days_stale}d unanswered` : "Needs reply"}
      </span>
    );
  if (status === "alert")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
        <AlertTriangle size={12} />
        Critical alerts
      </span>
    );
  if (status === "onboarding")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-sky-500">
        <Clock size={12} />
        Onboarding
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-bip-muted">
      <CheckCircle2 size={12} className="text-emerald-500/70" />
      Healthy
    </span>
  );
}

const STATUS_ORDER: Record<RowStatus, number> = {
  needs_reply: 0,
  alert: 1,
  onboarding: 2,
  ok: 3,
};

const FILTER_PARAM_VALUES = new Set<Filter>(["all", "needs_reply", "alerts", "onboarding"]);

export default function ClientSelectHome({
  clients,
  gscSignalSummariesByClient,
  adsSignalSummariesByClient,
  threadPreviews,
}: ClientListInitialData) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [strategist, setStrategist] = useState<string>("all");
  const [showWebsiteOnly, setShowWebsiteOnly] = useState(false);
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
      if (q) setQuery(q);
      if (flt && FILTER_PARAM_VALUES.has(flt)) setFilter(flt);
      if (strat) setStrategist(strat);
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
    const qs = params.toString();
    writeStoredClientListHref(qs ? `${CLIENT_LIST_PATH}?${qs}` : CLIENT_LIST_PATH);
  }, [hydrated, query, filter, strategist]);

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return enriched
      .filter(({ client, status }) => {
        const isWebsiteOnly = client.tier === WEBSITE_ONLY_TIER;
        if (!showWebsiteOnly && isWebsiteOnly) return false;
        if (
          q &&
          !client.account_name?.toLowerCase().includes(q) &&
          !(client.marketing_strategist ?? "").toLowerCase().includes(q)
        )
          return false;
        if (strategist !== "all" && (client.marketing_strategist ?? "") !== strategist) return false;
        if (filter === "needs_reply") return status === "needs_reply";
        if (filter === "alerts") return status === "alert";
        if (filter === "onboarding") return status === "onboarding";
        return true;
      })
      .sort((a, b) => {
        const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (sd !== 0) return sd;
        return (a.client.account_name ?? "").localeCompare(b.client.account_name ?? "");
      });
  }, [enriched, query, filter, strategist, showWebsiteOnly]);

  const activeClients = useMemo(
    () => enriched.filter((r) => r.client.tier !== WEBSITE_ONLY_TIER),
    [enriched],
  );

  const counts = useMemo(
    () => ({
      needs_reply: activeClients.filter((r) => r.status === "needs_reply").length,
      alerts: activeClients.filter((r) => r.status === "alert").length,
      onboarding: activeClients.filter((r) => r.status === "onboarding").length,
      website_only: enriched.filter((r) => r.client.tier === WEBSITE_ONLY_TIER).length,
    }),
    [enriched, activeClients],
  );

  const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All", count: activeClients.length },
    { id: "needs_reply", label: "Needs reply", count: counts.needs_reply },
    { id: "alerts", label: "Alerts", count: counts.alerts },
    { id: "onboarding", label: "Onboarding", count: counts.onboarding },
  ];

  return (
    <div className="min-h-full bg-bip-page">
      <div className="mx-auto max-w-6xl px-8 py-12">
        {/* Hero */}
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-bip-subtle">
          Beyond Indigo · Client Hub
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-bip-text md:text-5xl">
          Who are we helping today?
        </h1>
        <div className="mt-5 h-1.5 w-28 rounded-full bg-gradient-to-r from-lime-300 via-sky-400 to-pink-400" />
        <p className="mt-4 text-sm text-bip-muted">
          {activeClients.length} active clients
          {counts.needs_reply > 0 && ` · ${counts.needs_reply} waiting on a reply`}
          {counts.alerts > 0 && ` · ${counts.alerts} with critical alerts`}
        </p>

        {/* Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 md:max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-bip-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-full border border-bip-border bg-bip-card py-2.5 pl-10 pr-4 text-sm text-bip-text outline-none transition focus:border-bip-accent"
            />
          </div>
          <select
            value={strategist}
            onChange={(e) => setStrategist(e.target.value)}
            className="rounded-full border border-bip-border bg-bip-card px-4 py-2.5 text-sm text-bip-text outline-none"
          >
            <option value="all">All strategists</option>
            {strategistOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    active
                      ? "border-bip-text bg-bip-text text-bip-page"
                      : "border-bip-border bg-bip-card text-bip-muted hover:border-bip-text hover:text-bip-text"
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 tabular-nums ${active ? "opacity-70" : "text-bip-subtle"}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-bip-border py-16 text-center">
            <p className="text-sm text-bip-muted">No clients match.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(({ client, status, services, lastThread }) => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="group relative flex flex-col rounded-3xl border border-bip-border bg-bip-card p-6 transition duration-150 hover:-translate-y-0.5 hover:border-bip-text hover:shadow-lg"
              >
                <div className={`h-1 w-14 rounded-full ${STATUS_ACCENT[status]}`} />
                <h2 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-bip-text">
                  {client.account_name}
                </h2>
                {client.marketing_strategist && (
                  <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-bip-subtle">
                    {client.marketing_strategist}
                  </p>
                )}
                <div className="mt-3">
                  <StatusLine status={status} client={client} />
                </div>

                <div className="mt-auto flex items-end justify-between pt-5">
                  <div className="min-w-0">
                    {services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {services.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-bip-border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-bip-muted"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {lastThread?.occurred_at && (
                      <p className="mt-2 truncate text-[0.7rem] text-bip-subtle">
                        Last message {daysAgoLabel(lastThread.occurred_at)}
                      </p>
                    )}
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bip-border text-bip-muted transition group-hover:border-bip-text group-hover:bg-bip-text group-hover:text-bip-page">
                    <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Website-only toggle */}
        {counts.website_only > 0 && (
          <button
            onClick={() => setShowWebsiteOnly((v) => !v)}
            className="mt-8 text-xs text-bip-subtle underline-offset-2 hover:text-bip-text hover:underline"
          >
            {showWebsiteOnly ? "Hide" : "Show"} {counts.website_only} website-only clients
          </button>
        )}
      </div>
    </div>
  );
}
