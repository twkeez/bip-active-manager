"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import type { ClientListInitialData } from "@/lib/dashboard/load-client-list-data";
import { norm, getClientActiveServices } from "@/lib/clients/service-active";
import { shouldShowReplyAlert } from "@/lib/clients/acknowledge-no-reply";
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

function StatusPip({ status }: { status: RowStatus }) {
  if (status === "needs_reply")
    return <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />;
  if (status === "alert")
    return <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />;
  if (status === "onboarding")
    return <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />;
  return <span className="h-2 w-2 rounded-full bg-emerald-500/50 shrink-0" />;
}

function StatusLabel({ status, client }: { status: RowStatus; client: ClientRow }) {
  if (status === "needs_reply")
    return (
      <span className="flex items-center gap-1 text-[11px] text-red-400">
        <MessageSquare size={11} />
        {client.days_stale != null ? `${client.days_stale}d unanswered` : "Needs reply"}
      </span>
    );
  if (status === "alert")
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-400">
        <AlertTriangle size={11} />
        Critical alerts
      </span>
    );
  if (status === "onboarding")
    return (
      <span className="flex items-center gap-1 text-[11px] text-blue-400">
        <Clock size={11} />
        Onboarding
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[11px] text-emerald-500/70">
      <CheckCircle2 size={11} />
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

export default function ClientListView({
  clients,
  gscSignalSummariesByClient,
  adsSignalSummariesByClient,
  threadPreviews,
}: ClientListInitialData) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [strategist, setStrategist] = useState<string>("all");
  const [showWebsiteOnly, setShowWebsiteOnly] = useState(false);

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
        if (q && !client.account_name?.toLowerCase().includes(q)) return false;
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

  const counts = useMemo(() => ({
    needs_reply: activeClients.filter((r) => r.status === "needs_reply").length,
    alerts: activeClients.filter((r) => r.status === "alert").length,
    onboarding: activeClients.filter((r) => r.status === "onboarding").length,
    website_only: enriched.filter((r) => r.client.tier === WEBSITE_ONLY_TIER).length,
  }), [enriched, activeClients]);

  const FILTERS: Array<{ id: Filter; label: string; count?: number }> = [
    { id: "all", label: "All clients", count: clients.length },
    { id: "needs_reply", label: "Needs reply", count: counts.needs_reply },
    { id: "alerts", label: "Critical alerts", count: counts.alerts },
    { id: "onboarding", label: "Onboarding", count: counts.onboarding },
  ];

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-bip-text">Clients</h1>
          <p className="text-xs text-bip-muted">
            {activeClients.length} active · {counts.website_only} website only
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-3 py-2 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20"
        >
          <Plus size={13} /> Add client
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        {/* Row 1: search + strategist dropdown + website-only toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-bip-subtle" />
            <input
              type="text"
              placeholder="Search clients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-bip-border bg-bip-card/50 py-2 pl-8 pr-3 text-sm text-bip-text placeholder-bip-subtle focus:border-bip-border focus:outline-none"
            />
          </div>
          <select
            value={strategist}
            onChange={(e) => setStrategist(e.target.value)}
            className="rounded-lg border border-bip-border bg-bip-card/50 py-2 pl-3 pr-7 text-xs text-bip-muted focus:border-bip-border focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">All strategists</option>
            {strategistOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowWebsiteOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition whitespace-nowrap ${
              showWebsiteOnly
                ? "border-bip-accent/30 bg-bip-accent/10 text-bip-accent"
                : "border-bip-border text-bip-muted hover:text-bip-muted"
            }`}
          >
            {showWebsiteOnly ? <Eye size={12} /> : <EyeOff size={12} />}
            Website only
          </button>
        </div>

        {/* Row 2: status filter chips */}
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                filter === f.id
                  ? "border-bip-accent/30 bg-bip-accent/10 text-bip-accent"
                  : "border-bip-border bg-transparent text-bip-muted hover:text-bip-muted"
              }`}
            >
              {f.label}
              {f.count != null && f.count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === f.id
                      ? "bg-bip-accent/20 text-bip-accent"
                      : "bg-bip-fill text-bip-subtle"
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Client table */}
      <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card/40">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-bip-muted">
              {query ? `No clients match "${query}"` : "No clients in this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-bip-border">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-bip-subtle">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-bip-subtle sm:table-cell">
                  Services
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-bip-subtle">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-bip-subtle lg:table-cell">
                  Last comms
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-bip-subtle md:table-cell">
                  Strategist
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bip-border">
              {filtered.map(({ client, status, services, lastThread }) => (
                <tr
                  key={client.id}
                  className="group transition hover:bg-bip-hover"
                >
                  {/* Client name */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <StatusPip status={status} />
                      <span className="font-medium text-bip-text group-hover:text-bip-text transition-colors">
                        {client.account_name ?? "—"}
                      </span>
                    </Link>
                  </td>

                  {/* Services */}
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {services.length > 0 ? (
                        services.map((s) => (
                          <span
                            key={s}
                            className="rounded border border-bip-border px-1.5 py-0.5 text-[10px] text-bip-muted"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-bip-subtle">—</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusLabel status={status} client={client} />
                  </td>

                  {/* Last comms */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {lastThread ? (
                      <div>
                        <p className="text-xs text-bip-muted truncate max-w-[200px]">
                          {norm(lastThread.thread_title) || "Untitled thread"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-bip-subtle">
                          {daysAgoLabel(lastThread.occurred_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-bip-subtle">No recent comms</span>
                    )}
                  </td>

                  {/* Strategist */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="text-xs text-bip-muted">
                      {norm(client.marketing_strategist) || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-bip-subtle">
          Showing {filtered.length} of {showWebsiteOnly ? clients.length : activeClients.length} clients
          {strategist !== "all" && ` · ${strategist}`}
          {query && ` matching "${query}"`}
        </p>
      )}
    </div>
  );
}
