import Link from "next/link";
import { ArrowRight, DollarSign, MousePointerClick, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";

export type FlaggedAccount = { clientId: number; name: string };

type Row = { label: string; accounts: FlaggedAccount[]; href: string; hrefLabel: string };
type Category = { key: string; title: string; icon: LucideIcon; blurb: string; rows: Row[] };

const MAX_CHIPS = 8;

function fmtSync(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdsHealthView({
  budgetCapped,
  budgetHogs,
  qualityGlobal,
  landingPages,
  conversion,
  accountsScanned,
  lastSyncAt,
  loadError,
}: {
  budgetCapped: FlaggedAccount[];
  budgetHogs: FlaggedAccount[];
  qualityGlobal: FlaggedAccount[];
  landingPages: FlaggedAccount[];
  conversion: FlaggedAccount[];
  accountsScanned: number;
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
        { label: "Capped by budget", accounts: budgetCapped, href: "/global-ads-optimization", hrefLabel: "Global Ads" },
        { label: "Runaway spend", accounts: budgetHogs, href: "/ppc-defense", hrefLabel: "PPC Defense" },
      ],
    },
    {
      key: "quality",
      title: "Quality & relevance",
      icon: MousePointerClick,
      blurb: "Weak Quality Score inputs — ad relevance, CTR, and landing pages.",
      rows: [
        { label: "Low relevance / CTR / QS", accounts: qualityGlobal, href: "/global-ads-optimization", hrefLabel: "Global Ads" },
        { label: "Weak landing pages", accounts: landingPages, href: "/ppc-defense", hrefLabel: "PPC Defense" },
      ],
    },
    {
      key: "conversion",
      title: "Conversion tracking",
      icon: Target,
      blurb: "Tracking gaps and anomalies — the foundation every other metric rests on.",
      rows: [
        { label: "Tracking anomalies", accounts: conversion, href: "/conversion-integrity", hrefLabel: "Conversion Integrity" },
      ],
    },
  ];

  const catTotal = (c: Category) => c.rows.reduce((s, r) => s + r.accounts.length, 0);
  const areasFlagged = categories.filter((c) => catTotal(c) > 0).length;

  return (
    <ToolPage
      title="Ads Health"
      icon={DollarSign}
      description={`One glance across every ads account — which are flagged for budget, quality, or conversion problems, and who. Click an account to open it; open a radar for the full detail. ${accountsScanned} accounts · last sync ${fmtSync(lastSyncAt)}.`}
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
                accounts under the highest counts.
              </>
            )}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((c) => {
              const flagged = catTotal(c) > 0;
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

                  <div className="mt-3 flex flex-col gap-3 border-t border-bip-border pt-3">
                    {c.rows.map((r) => (
                      <div key={r.label}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-bip-text">{r.label}</span>
                          <span className={`text-sm font-semibold tabular-nums ${r.accounts.length > 0 ? "text-amber-300" : "text-bip-muted"}`}>
                            {r.accounts.length}
                          </span>
                        </div>
                        {r.accounts.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {r.accounts.slice(0, MAX_CHIPS).map((a) => (
                              <Link
                                key={a.clientId}
                                href={`/dashboard/clients/${a.clientId}?tab=ads`}
                                className="max-w-full truncate rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-text hover:bg-bip-border"
                                title={a.name}
                              >
                                {a.name}
                              </Link>
                            ))}
                            {r.accounts.length > MAX_CHIPS && (
                              <Link
                                href={r.href}
                                className="rounded-md px-2 py-0.5 text-[11px] text-bip-muted hover:text-bip-text"
                              >
                                +{r.accounts.length - MAX_CHIPS} more
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
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
