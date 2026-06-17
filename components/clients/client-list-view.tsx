"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
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
        if (q && !client.account_name?.toLowerCase().includes(q)) return false;
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
  }, [enriched, query, filter]);

  const counts = useMemo(() => ({
    needs_reply: enriched.filter((r) => r.status === "needs_reply").length,
    alerts: enriched.filter((r) => r.status === "alert").length,
    onboarding: enriched.filter((r) => r.status === "onboarding").length,
  }), [enriched]);

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
          <h1 className="text-lg font-semibold text-white">Clients</h1>
          <p className="text-xs text-white/40">{clients.length} accounts</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-3 py-2 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20"
        >
          <Plus size={13} /> Add client
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-bip-card/50 py-2 pl-8 pr-3 text-sm text-white placeholder-white/25 focus:border-white/20 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                filter === f.id
                  ? "border-bip-accent/30 bg-bip-accent/10 text-bip-accent"
                  : "border-white/[0.08] bg-transparent text-white/45 hover:text-white/70"
              }`}
            >
              {f.label}
              {f.count != null && f.count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === f.id
                      ? "bg-bip-accent/20 text-bip-accent"
                      : "bg-white/[0.08] text-white/35"
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
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-bip-card/40">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-white/40">
              {query ? `No clients match "${query}"` : "No clients in this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 sm:table-cell">
                  Services
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 lg:table-cell">
                  Last comms
                </th>
                <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 md:table-cell">
                  Strategist
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(({ client, status, services, lastThread }) => (
                <tr
                  key={client.id}
                  className="group transition hover:bg-white/[0.02]"
                >
                  {/* Client name */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <StatusPip status={status} />
                      <span className="font-medium text-white/85 group-hover:text-white transition-colors">
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
                            className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/40"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-white/20">—</span>
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
                        <p className="text-xs text-white/50 truncate max-w-[200px]">
                          {norm(lastThread.thread_title) || "Untitled thread"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/25">
                          {daysAgoLabel(lastThread.occurred_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-white/20">No recent comms</span>
                    )}
                  </td>

                  {/* Strategist */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="text-xs text-white/40">
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
        <p className="text-xs text-white/25">
          {filtered.length} of {clients.length} clients
          {query && ` matching "${query}"`}
        </p>
      )}
    </div>
  );
}
