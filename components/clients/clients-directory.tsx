"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Search, Users } from "lucide-react";
import { getClientActiveServices } from "@/lib/clients/service-active";
import {
  CLIENT_STATUS_LABEL,
  CLIENT_STATUS_WIDGET_LABEL,
  countByLifecycleStatus,
  getClientLifecycleStatus,
  type ClientLifecycleStatus,
} from "@/lib/clients/client-status";
import type { ClientRow } from "@/lib/types/client";

// Clients page, rebuilt from the design handoff. Tokens are the handoff's
// literal values, so colours are hex rather than theme variables.

const T = {
  bg: "#F5F4EF",
  surface: "#FFFFFF",
  ink: "#191813",
  secondary: "#6E6A5E",
  muted: "#8A8678",
  faint: "#A5A091",
  border: "#E6E3DA",
  rowBorder: "#F0EEE7",
  tagBorder: "#E9E6DD",
  hover: "#FAF9F4",
  blue: "#2B3FE4",
  blueHover: "#1F31C8",
  blueTint: "#E8EAFD",
  blueTintSoft: "#EDEFFE",
  blueTintBorder: "#B9C1F5",
  green: "#1F7A4D",
  greenTint: "#E4F2E9",
  amber: "#B7791F",
  amberTint: "#FFF3DC",
};

const STATUS_DOT: Record<ClientLifecycleStatus, string> = {
  active: T.green,
  onboarding: T.blue,
  launch: T.amber,
};

const STATUS_PILL: Record<ClientLifecycleStatus, { bg: string; fg: string }> = {
  active: { bg: T.greenTint, fg: T.green },
  onboarding: { bg: T.blueTint, fg: T.blue },
  launch: { bg: T.amberTint, fg: T.amber },
};

/** Fixed display order, per the handoff. */
const SERVICE_ORDER = ["SEO", "PPC", "SMM", "ORM", "Blog"] as const;
type ServiceKey = (typeof SERVICE_ORDER)[number];

const SERVICE_FROM_FLAG: Record<string, ServiceKey> = {
  seo: "SEO",
  ppc: "PPC",
  smm: "SMM",
  orm: "ORM",
  blog: "Blog",
};

function servicesFor(client: ClientRow): ServiceKey[] {
  const active = getClientActiveServices(client);
  return SERVICE_ORDER.filter((label) =>
    Object.entries(active).some(([key, on]) => on && SERVICE_FROM_FLAG[key] === label),
  );
}

const ROW_GRID = "minmax(240px,1.7fr) 150px minmax(220px,1.3fr) 130px 30px";

export type DirectoryClient = ClientRow;

export function ClientsDirectory({ clients }: { clients: DirectoryClient[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientLifecycleStatus | null>(null);
  const [strategistFilter, setStrategistFilter] = useState<string | null>(null);
  const [serviceFilters, setServiceFilters] = useState<ServiceKey[]>([]);
  const [sort, setSort] = useState<"name" | "strategist">("name");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derived once — widget counts come from the whole book so they never move
  // while filtering.
  const enriched = useMemo(
    () =>
      clients.map((c) => ({
        client: c,
        status: getClientLifecycleStatus(c),
        services: servicesFor(c),
        strategist: (c.marketing_strategist ?? "").trim(),
      })),
    [clients],
  );

  const counts = useMemo(() => countByLifecycleStatus(clients), [clients]);

  const strategistOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of enriched) {
      if (!row.strategist) continue;
      map.set(row.strategist, (map.get(row.strategist) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [enriched]);

  const filtersOn =
    Boolean(query.trim()) || statusFilter !== null || strategistFilter !== null || serviceFilters.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = enriched.filter((row) => {
      if (q && !row.client.account_name?.toLowerCase().includes(q) && !row.strategist.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter && row.status !== statusFilter) return false;
      if (strategistFilter && row.strategist !== strategistFilter) return false;
      // Services combine with AND — the client must have every selected one.
      if (serviceFilters.length && !serviceFilters.every((s) => row.services.includes(s))) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === "strategist") {
        const s = (a.strategist || "￿").localeCompare(b.strategist || "￿");
        if (s !== 0) return s;
      }
      return (a.client.account_name ?? "").localeCompare(b.client.account_name ?? "");
    });
  }, [enriched, query, statusFilter, strategistFilter, serviceFilters, sort]);

  function clearAll() {
    setQuery("");
    setStatusFilter(null);
    setStrategistFilter(null);
    setServiceFilters([]);
    if (searchRef.current) searchRef.current.value = "";
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  const total = clients.length;
  const widgets: Array<{ key: ClientLifecycleStatus }> = [
    { key: "active" },
    { key: "onboarding" },
    { key: "launch" },
  ];

  return (
    <div
      style={{ background: T.bg, fontFamily: "var(--font-instrument-sans), system-ui, sans-serif" }}
      className="min-h-full"
    >
      <div className="mx-auto w-full max-w-[1230px] px-[34px] pb-12 pt-[30px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p style={{ color: T.muted, letterSpacing: "0.11em" }} className="text-[10.5px] font-bold uppercase">
              BIP Control · Clients
            </p>
            <h1
              style={{ color: T.ink, letterSpacing: "-0.02em" }}
              className="mt-1.5 text-[34px] font-semibold leading-tight"
            >
              Who are we{" "}
              <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: "1.06em" }} className="italic">
                helping
              </span>{" "}
              today?
            </h1>
          </div>
          <button
            onClick={() => showToast("Add client — coming soon.")}
            style={{ background: T.blue }}
            className="rounded-full px-[18px] py-[9px] text-[13px] font-semibold text-white transition-colors hover:opacity-90"
          >
            + Add client
          </button>
        </div>

        {/* Stat widgets */}
        <div className="mt-6 flex flex-wrap gap-3">
          {widgets.map(({ key }) => {
            const selected = statusFilter === key;
            const n = counts[key];
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter((s) => (s === key ? null : key))}
                style={{
                  background: T.surface,
                  borderColor: selected ? T.blue : T.border,
                  boxShadow: selected ? "0 0 0 3px rgba(43,63,228,0.10)" : undefined,
                }}
                className="min-w-[190px] flex-1 rounded-2xl border px-[18px] py-4 text-left transition-colors hover:border-[#C9C4B5]"
              >
                <span className="flex items-center gap-2">
                  <span
                    style={{ background: STATUS_DOT[key] }}
                    className="inline-block h-2 w-2 rounded-full"
                  />
                  <span
                    style={{ color: T.muted, letterSpacing: "0.09em" }}
                    className="text-[10.5px] font-bold uppercase"
                  >
                    {CLIENT_STATUS_WIDGET_LABEL[key]}
                  </span>
                </span>
                <span
                  style={{ color: T.ink, letterSpacing: "-0.03em" }}
                  className="mt-2.5 block text-[36px] font-bold leading-none tabular-nums"
                >
                  {n}
                </span>
                <span
                  style={{ color: selected ? T.blue : T.faint }}
                  className="mt-[7px] block text-[11.5px] font-semibold"
                >
                  {selected ? "Filtering · click to clear" : `${pct}% of book`}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => showToast("Widget gallery — launches, tasks due, review alerts…")}
            style={{ borderColor: "#D9D5C9", color: T.faint }}
            className="flex-[0.8] rounded-2xl border-[1.5px] border-dashed px-[18px] py-4 text-left transition-colors hover:border-[#C9C4B5] hover:text-[#8A8678]"
          >
            <span className="block text-[13px] font-semibold">+ Add widget</span>
            <span className="mt-1 block text-[11px]">Launches · Tasks due · Alerts</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="mt-[22px] flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.8}
              style={{ color: T.faint }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              ref={searchRef}
              defaultValue={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients or strategists…"
              style={{ background: T.surface, borderColor: T.border, color: T.ink }}
              className="w-[250px] rounded-[10px] border py-2 pl-8 pr-3 text-[12.5px] outline-none placeholder:text-[#A5A091] focus:border-[#C9C4B5]"
            />
          </div>

          {/* Strategist */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{ background: T.surface, borderColor: T.border, color: T.ink }}
              className="flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold"
            >
              <Users size={14} strokeWidth={1.8} style={{ color: T.secondary }} />
              {strategistFilter ?? "All strategists"}
              <ChevronDown size={13} strokeWidth={2} style={{ color: T.faint }} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div
                  style={{
                    background: T.surface,
                    borderColor: T.border,
                    boxShadow: "0 18px 44px rgba(20,18,10,0.16)",
                  }}
                  className="absolute left-0 top-full z-20 mt-1.5 max-h-[320px] w-[230px] overflow-y-auto rounded-[13px] border p-[5px]"
                >
                  <button
                    onClick={() => { setStrategistFilter(null); setDropdownOpen(false); }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-semibold hover:bg-[#F6F5F0]"
                    style={{ color: T.ink }}
                  >
                    All strategists
                    {strategistFilter === null && <Check size={13} strokeWidth={2.2} style={{ color: T.blue }} />}
                  </button>
                  {strategistOptions.map(([name, n]) => (
                    <button
                      key={name}
                      onClick={() => { setStrategistFilter(name); setDropdownOpen(false); }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-semibold hover:bg-[#F6F5F0]"
                      style={{ color: T.ink }}
                    >
                      <span className="truncate">{name}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span style={{ color: T.faint }} className="text-[11px] font-medium tabular-nums">{n}</span>
                        {strategistFilter === name && <Check size={13} strokeWidth={2.2} style={{ color: T.blue }} />}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span style={{ color: T.faint, letterSpacing: "0.08em" }} className="text-[10.5px] font-bold uppercase">
              Sort
            </span>
            <div style={{ background: T.surface, borderColor: T.border }} className="flex rounded-[10px] border p-[2px]">
              {(["name", "strategist"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  style={{
                    background: sort === s ? T.ink : undefined,
                    color: sort === s ? "#F5F4EF" : T.secondary,
                  }}
                  className="rounded-lg px-[13px] py-[5px] text-[12px] font-semibold capitalize transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: "#E0DCD0" }} className="h-[22px] w-px" />

          {/* Services */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SERVICE_ORDER.map((s) => {
              const on = serviceFilters.includes(s);
              return (
                <button
                  key={s}
                  onClick={() =>
                    setServiceFilters((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))
                  }
                  style={{
                    background: on ? T.ink : T.surface,
                    borderColor: on ? T.ink : T.border,
                    color: on ? "#F5F4EF" : T.secondary,
                    letterSpacing: "0.04em",
                  }}
                  className="rounded-full border px-3 py-[5px] text-[11.5px] font-bold transition-colors"
                >
                  {s}
                </button>
              );
            })}
          </div>

          {filtersOn && (
            <button onClick={clearAll} style={{ color: T.blue }} className="text-[12px] font-semibold">
              Clear
            </button>
          )}

          <span style={{ color: T.muted }} className="ml-auto text-[12px] font-semibold tabular-nums">
            {filtersOn ? `${filtered.length} of ${total}` : `${total} clients`}
          </span>
        </div>

        {/* List */}
        <div
          style={{ background: T.surface, borderColor: T.border }}
          className="mt-3.5 overflow-hidden rounded-2xl border"
        >
          <div
            style={{ gridTemplateColumns: ROW_GRID, color: T.faint, letterSpacing: "0.08em" }}
            className="grid items-center gap-3 px-[18px] pb-[9px] pt-[11px] text-[10.5px] font-bold uppercase"
          >
            <span>Client</span>
            <span>Strategist</span>
            <span>Services</span>
            <span>Status</span>
            <span />
          </div>

          {filtered.length === 0 ? (
            <div className="px-[18px] py-11 text-center">
              <p style={{ color: T.secondary }} className="text-[14px] font-semibold">No clients match</p>
              <button onClick={clearAll} style={{ color: T.blue }} className="mt-1.5 text-[12.5px] font-semibold">
                Clear all filters
              </button>
            </div>
          ) : (
            filtered.map((row, i) => {
              const prev = filtered[i - 1];
              const showGroup =
                sort === "strategist" && (i === 0 || prev.strategist !== row.strategist);
              const groupCount = filtered.filter((r) => r.strategist === row.strategist).length;
              const pill = STATUS_PILL[row.status];

              return (
                <div key={row.client.id}>
                  {showGroup && (
                    <div
                      style={{ background: T.hover, borderColor: T.rowBorder }}
                      className="flex items-center gap-2 border-t px-[18px] py-[7px]"
                    >
                      <span
                        style={{ color: T.secondary, letterSpacing: "0.07em" }}
                        className="text-[11px] font-bold uppercase"
                      >
                        {row.strategist || "Unassigned"}
                      </span>
                      <span style={{ color: T.faint }} className="text-[11px] font-semibold">
                        {groupCount} client{groupCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}
                  <Link
                    href={`/dashboard/clients/${row.client.id}`}
                    style={{ gridTemplateColumns: ROW_GRID, borderColor: T.rowBorder }}
                    className="grid items-center gap-3 border-t px-[18px] py-[11px] transition-colors hover:bg-[#FAF9F4]"
                  >
                    <span style={{ color: T.ink }} className="truncate text-[13.5px] font-semibold">
                      {row.client.account_name}
                    </span>
                    <span style={{ color: T.secondary }} className="truncate text-[12.5px]">
                      {row.strategist || "—"}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {row.services.map((s) => {
                        const highlighted = serviceFilters.includes(s);
                        return (
                          <span
                            key={s}
                            style={{
                              background: highlighted ? T.blueTintSoft : T.hover,
                              borderColor: highlighted ? T.blueTintBorder : T.tagBorder,
                              color: highlighted ? T.blue : T.secondary,
                              letterSpacing: "0.06em",
                            }}
                            className="rounded-md border px-[7px] py-[2.5px] text-[10px] font-bold"
                          >
                            {s}
                          </span>
                        );
                      })}
                    </span>
                    <span>
                      <span
                        style={{ background: pill.bg, color: pill.fg }}
                        className="inline-block rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                      >
                        {CLIENT_STATUS_LABEL[row.status]}
                      </span>
                    </span>
                    <ChevronRight size={15} strokeWidth={1.8} style={{ color: "#B9B4A5" }} />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>

      {toast && (
        <div
          style={{ background: T.ink, boxShadow: "0 18px 44px rgba(20,18,10,0.16)" }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-[#F5F4EF]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
