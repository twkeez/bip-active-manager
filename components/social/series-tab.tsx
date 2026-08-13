"use client";

import { useMemo, useState } from "react";
import { Layers, Repeat } from "lucide-react";
import { getCampaignType } from "@/lib/social/campaign-types";
import { purposeStyle } from "@/lib/social/purpose-style";
import type { SocialSeriesWithParts } from "@/lib/social/types";
import type { CalendarClient } from "./calendar-builder";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const WEEKDAY_LABEL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** Read-only for now — creating and editing series comes later. */
export function SeriesTab({
  series,
  clients,
}: {
  series: SocialSeriesWithParts[];
  clients: CalendarClient[];
}) {
  const [kindFilter, setKindFilter] = useState<"all" | "recurring" | "arc">("all");

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.account_name]));
    return (id: number | null) => (id == null ? "All practices" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  const filtered = series.filter((s) => kindFilter === "all" || s.kind === kindFilter);

  const counts = {
    all: series.length,
    recurring: series.filter((s) => s.kind === "recurring").length,
    arc: series.filter((s) => s.kind === "arc").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Series</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Recurring slots that repeat on a cadence, and arcs that tell an ordered story in parts.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "recurring", "arc"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                kindFilter === k
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200/80 bg-white text-slate-500 shadow-sm hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {k === "all" ? "All" : k === "recurring" ? "Recurring" : "Arc"}
              <span className={`ml-1.5 tabular-nums ${kindFilter === k ? "opacity-60" : "text-slate-400"}`}>
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No series yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Series management is coming — for now they can be added directly in the database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <SeriesCard key={s.id} series={s} clientLabel={clientName(s.client_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SeriesCard({
  series,
  clientLabel,
  compact = false,
}: {
  series: SocialSeriesWithParts;
  clientLabel?: string;
  compact?: boolean;
}) {
  const ct = getCampaignType(series.campaign_type);
  const ps = purposeStyle(series.purpose);
  const isArc = series.kind === "arc";

  const rhythm = isArc
    ? `${series.parts.length} part${series.parts.length === 1 ? "" : "s"}${
        series.spacing_days ? ` · every ${series.spacing_days}d` : ""
      }`
    : [
        series.cadence ? CADENCE_LABEL[series.cadence] ?? series.cadence : null,
        series.day_of_week != null ? WEEKDAY_LABEL[series.day_of_week] : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{series.title}</p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
            isArc
              ? "border-violet-200/60 bg-violet-50 text-violet-700"
              : "border-sky-200/60 bg-sky-50 text-sky-700"
          }`}
        >
          {isArc ? <Layers size={10} /> : <Repeat size={10} />}
          {isArc ? "Arc" : "Recurring"}
        </span>
      </div>

      {!compact && <p className="mt-1.5 text-sm text-slate-600">{series.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {series.purpose && (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ps.pill}`}>{ps.label}</span>
        )}
        {ct && (
          <span className="rounded-full border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
            {ct.label}
          </span>
        )}
        {rhythm && <span className="text-xs font-medium text-slate-400">{rhythm}</span>}
      </div>

      {clientLabel && <p className="mt-2 text-xs font-medium text-slate-400">{clientLabel}</p>}
    </div>
  );
}
