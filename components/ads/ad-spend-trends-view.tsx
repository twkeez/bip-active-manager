"use client";

import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { ToolPage } from "@/components/ui/tool-page";
import type { ClientSpendTrend, SpendTrendsData } from "@/lib/ads/load-spend-trends";
import type { SpendPoint } from "@/lib/ads/spend-trend";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtSyncAt(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Sparkline({ points }: { points: SpendPoint[] }) {
  if (points.length < 2) return <span className="text-[11px] text-bip-muted">—</span>;
  const w = 104;
  const h = 26;
  const pad = 3;
  const ys = points.map((p) => p.spendUsd);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const coord = (i: number): [number, number] => [
    pad + (i / (points.length - 1)) * (w - pad * 2),
    h - pad - ((ys[i] - minY) / span) * (h - pad * 2),
  ];
  const d = points
    .map((_, i) => {
      const [x, y] = coord(i);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const [lx, ly] = coord(points.length - 1);
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.4" fill="currentColor" />
    </svg>
  );
}

function TrendBadge({ trend }: { trend: ClientSpendTrend["trend"] }) {
  if (trend.status !== "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">
        <AlertTriangle className="h-3 w-3" /> Not enough history
      </span>
    );
  }
  const pct = `${trend.pctChange >= 0 ? "+" : ""}${Math.round(trend.pctChange)}%`;
  if (trend.direction === "rising") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
        <TrendingUp className="h-3.5 w-3.5" /> Rising {pct}
      </span>
    );
  }
  if (trend.direction === "falling") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
        <TrendingDown className="h-3.5 w-3.5" /> Falling {pct}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">
      <Minus className="h-3.5 w-3.5" /> Flat {pct}
    </span>
  );
}

function sparkTone(trend: ClientSpendTrend["trend"]): string {
  if (trend.status !== "ok") return "text-bip-muted";
  if (trend.direction === "rising") return "text-amber-400";
  if (trend.direction === "falling") return "text-sky-400";
  return "text-bip-muted";
}

export default function AdSpendTrendsView({ data }: { data: SpendTrendsData }) {
  const { clients, summary, lastSyncAt, loadError } = data;
  const trended = clients.filter((c) => c.trend.status === "ok");
  const insufficient = clients.filter((c) => c.trend.status === "insufficient");

  return (
    <ToolPage
      title="Ad Cost Trends"
      icon={TrendingUp}
      description={`Whether each Google Ads client's spend is trending up, from their 30-day snapshot history. Failed or empty syncs and one-off spikes are excluded so a bad data point can't fake a trend. Last ads sync: ${fmtSyncAt(lastSyncAt)}.`}
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          {data.benchmark && (
            <div className="rounded-xl border border-bip-accent/40 bg-bip-accent/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                Typical monthly Google Ads spend
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-semibold tabular-nums text-bip-text">
                  {usd.format(data.benchmark.median)}
                </span>
                <span className="text-sm text-bip-muted">median</span>
                <span className="text-sm text-bip-muted">
                  · most fall between{" "}
                  <span className="font-medium text-bip-text">{usd.format(data.benchmark.p25)}</span> and{" "}
                  <span className="font-medium text-bip-text">{usd.format(data.benchmark.p75)}</span>
                </span>
              </div>
              <p className="mt-1.5 text-xs text-bip-muted">
                Across {data.benchmark.count} of your Google Ads clients with current spend on record · avg{" "}
                {usd.format(data.benchmark.mean)}. This is a benchmark of the practices you run, not all vet
                hospitals.
              </p>
            </div>
          )}

          <StatTiles>
            <StatTile label="Ads clients" value={summary.adsClients} />
            <StatTile label="Rising" value={summary.rising} tone={summary.rising > 0 ? "warn" : undefined} />
            <StatTile label="Flat / falling" value={summary.flat + summary.falling} />
            <StatTile label="Not enough history" value={summary.insufficient} />
          </StatTiles>

          {trended.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-bip-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-bip-muted">
                <span>Client</span>
                <span className="text-right">Current 30d</span>
                <span className="text-center">History</span>
                <span className="text-right">Trend</span>
              </div>
              {trended.map((c) => (
                <div
                  key={c.clientId}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-bip-border px-4 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-bip-text">{c.accountName}</p>
                    {c.trend.status === "ok" && (
                      <p className="text-[11px] text-bip-muted">
                        {c.trend.sampleCount} pts · {c.trend.spanDays}d
                        {c.trend.droppedCount > 0 ? ` · ${c.trend.droppedCount} excluded` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm tabular-nums text-bip-text">
                    {c.trend.currentSpend != null ? usd.format(c.trend.currentSpend) : "—"}
                  </div>
                  <div className={`flex justify-center ${sparkTone(c.trend)}`}>
                    <Sparkline points={c.trend.points} />
                  </div>
                  <div className="text-right">
                    <TrendBadge trend={c.trend} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No client has enough snapshot history to trend yet."
              hint="Trends appear once a client has a few weekly ad syncs on record."
            />
          )}

          {insufficient.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                Not enough history yet ({insufficient.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {insufficient.map((c) => (
                  <span
                    key={c.clientId}
                    className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-1.5 text-xs text-bip-muted"
                  >
                    <span className="text-bip-text">{c.accountName}</span>
                    {c.trend.currentSpend != null && c.trend.currentSpend > 0 ? usd.format(c.trend.currentSpend) : "—"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </ToolPage>
  );
}
