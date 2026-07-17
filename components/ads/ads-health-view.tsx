import Link from "next/link";
import { ArrowRight, DollarSign, MousePointerClick, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import type { GlobalAdsOptimizationSummary } from "@/lib/ads/global-optimization";
import type { PpcDefenseSummary } from "@/lib/ads/ppc-defense";
import type { ConversionIntegritySummary } from "@/lib/ads/conversion-integrity";

type Row = { label: string; count: number; detail: string; href: string; hrefLabel: string };
type Category = { key: string; title: string; icon: LucideIcon; blurb: string; rows: Row[] };

function fmtSync(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdsHealthView({
  global,
  defense,
  conversion,
  lastSyncAt,
  loadError,
}: {
  global: GlobalAdsOptimizationSummary;
  defense: PpcDefenseSummary;
  conversion: ConversionIntegritySummary;
  lastSyncAt: string | null;
  loadError: string | null;
}) {
  const categories: Category[] = [
    {
      key: "budget",
      title: "Budget",
      icon: DollarSign,
      blurb: "Accounts capped by budget or overspending on the wrong things.",
      rows: [
        { label: "Capped by budget", count: global.budgetCappedAccountCount, detail: "losing impressions to budget", href: "/global-ads-optimization", hrefLabel: "Global Ads" },
        { label: "Runaway spend", count: defense.budgetHogCount, detail: `across ${defense.hogAccountsAffected} account${defense.hogAccountsAffected === 1 ? "" : "s"}`, href: "/ppc-defense", hrefLabel: "PPC Defense" },
      ],
    },
    {
      key: "quality",
      title: "Quality & relevance",
      icon: MousePointerClick,
      blurb: "Weak Quality Score inputs — ad relevance, CTR, and landing pages.",
      rows: [
        { label: "Low relevance / CTR", count: global.relevanceCtrAccountCount, detail: "accounts flagged", href: "/global-ads-optimization", hrefLabel: "Global Ads" },
        { label: "Weak landing pages", count: defense.lpDeficitCount, detail: `across ${defense.lpAccountsAffected} account${defense.lpAccountsAffected === 1 ? "" : "s"}`, href: "/ppc-defense", hrefLabel: "PPC Defense" },
      ],
    },
    {
      key: "conversion",
      title: "Conversion tracking",
      icon: Target,
      blurb: "Tracking gaps and anomalies — the foundation every other metric rests on.",
      rows: [
        { label: "Tracking anomalies", count: conversion.activeAnomalies, detail: `${conversion.criticalCount} critical · ${conversion.accountsAffected} account${conversion.accountsAffected === 1 ? "" : "s"}`, href: "/conversion-integrity", hrefLabel: "Conversion Radar" },
      ],
    },
  ];

  const catTotal = (c: Category) => c.rows.reduce((s, r) => s + r.count, 0);
  const areasFlagged = categories.filter((c) => catTotal(c) > 0).length;
  const accountsScanned = Math.max(defense.accountsScanned, conversion.accountsScanned, global.connectedAccountCount);

  return (
    <ToolPage
      title="Ads Health"
      icon={DollarSign}
      description={`One glance across every ads account — which are flagged for budget, quality, or conversion problems. Open a radar for the detail. ${accountsScanned} accounts · last sync ${fmtSync(lastSyncAt)}.`}
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          <p className="text-sm text-bip-muted">
            {areasFlagged === 0 ? (
              <span className="text-emerald-400">All clear — nothing flagged across budget, quality, or conversion.</span>
            ) : (
              <>
                <span className="font-medium text-amber-300">{areasFlagged} of 3 areas need attention.</span> Start with the
                highest counts below.
              </>
            )}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((c) => {
              const total = catTotal(c);
              const flagged = total > 0;
              const Icon = c.icon;
              return (
                <div key={c.key} className="flex flex-col rounded-xl border border-bip-border bg-bip-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-bip-text">
                      <Icon className="h-4 w-4 text-bip-accent" /> {c.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${flagged ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-400"}`}
                    >
                      {flagged ? "Needs attention" : "Clear"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-bip-muted">{c.blurb}</p>

                  <div className="mt-3 flex flex-col gap-2.5 border-t border-bip-border pt-3">
                    {c.rows.map((r) => (
                      <Link
                        key={r.label}
                        href={r.href}
                        className="group flex items-start justify-between gap-2 rounded-md -mx-1 px-1 py-0.5 hover:bg-bip-fill"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm text-bip-text">{r.label}</span>
                          <span className="block text-[11px] text-bip-muted">{r.detail}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className={`text-lg font-semibold tabular-nums ${r.count > 0 ? "text-amber-300" : "text-bip-muted"}`}>
                            {r.count}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-bip-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...new Set(c.rows.map((r) => `${r.href}|${r.hrefLabel}`))].map((h) => {
                      const [href, label] = h.split("|");
                      return (
                        <Link
                          key={href}
                          href={href}
                          className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:bg-bip-fill hover:text-bip-text"
                        >
                          {label} <ArrowRight className="h-3 w-3" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ToolPage>
  );
}
