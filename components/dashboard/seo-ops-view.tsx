"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { buildPage2Opportunities } from "@/lib/seo/page2-opportunities";
import { buildRankFluctuations } from "@/lib/seo/rank-fluctuations";
import type {
  SeoOpsEvaluation,
  SeoOpsItemStatus,
  SeoOpsCadence,
} from "@/lib/seo/ops/types";
import type {
  ClientRow,
  ClientKeywordTarget,
  GscQueryMetric,
  KeywordHealthRow,
} from "@/lib/types/client";

type Props = {
  client: ClientRow;
  gscQueryMetrics: GscQueryMetric[];
  gscSnapshotUpdatedAt: string | null;
  keywordTargets?: ClientKeywordTarget[];
  onOpenTab?: (tab: "reporting" | "seo") => void;
  onLoadKeywordHealth?: () => Promise<KeywordHealthRow[]>;
  keywordHealthRows?: KeywordHealthRow[];
  keywordHealthLoading?: boolean;
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-xs text-white/50">
        <span>
          {done}/{total} complete
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ItemRow({
  item,
  busy,
  onToggle,
  onOpenTab,
}: {
  item: SeoOpsItemStatus;
  busy: boolean;
  onToggle: (itemKey: string, cadence: SeoOpsCadence, done: boolean) => void;
  onOpenTab?: (tab: "reporting" | "seo") => void;
}) {
  const isManual = item.verification.startsWith("manual:");
  const actionTab = item.actionTab;

  return (
    <li className="flex items-start gap-2 border-b border-white/[0.08] py-2.5 last:border-0">
      {isManual ? (
        <button
          type="button"
          disabled={busy || item.skipped}
          onClick={() => onToggle(item.itemKey, item.cadence, !item.done)}
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            item.done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-white/[0.12] bg-bip-card text-transparent hover:border-emerald-500"
          }`}
          aria-label={item.done ? "Mark incomplete" : "Mark complete"}
        >
          <Check className="h-3 w-3" />
        </button>
      ) : item.done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            item.done ? "text-white/50 line-through" : "font-medium text-white"
          }`}
        >
          {item.label}
        </p>
        {item.hint && !item.done && (
          <p className="mt-0.5 text-xs text-white/50">{item.hint}</p>
        )}
        {item.autoVerified && item.done && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-emerald-500">
            Auto-verified
          </p>
        )}
        {item.notes && (
          <p className="mt-1 text-xs italic text-white/40">Notes: {item.notes}</p>
        )}
        {actionTab && actionTab !== "seo_ops" && !item.done && onOpenTab && (
          <button
            type="button"
            onClick={() =>
              onOpenTab(actionTab === "reporting" ? "reporting" : "seo")
            }
            className="mt-1 text-xs font-medium text-bip-accent hover:underline"
          >
            Open {actionTab === "reporting" ? "Reporting" : "SEO"} tab
          </button>
        )}
      </div>
    </li>
  );
}

export default function SeoOpsView({
  client,
  gscQueryMetrics,
  gscSnapshotUpdatedAt,
  keywordTargets = [],
  onOpenTab,
  onLoadKeywordHealth,
  keywordHealthRows = [],
  keywordHealthLoading = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<SeoOpsEvaluation | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [localKeywordRows, setLocalKeywordRows] = useState(keywordHealthRows);
  const [keywordRefreshedAt, setKeywordRefreshedAt] = useState<string | null>(
    null,
  );

  const page2Opportunities = useMemo(
    () => buildPage2Opportunities(gscQueryMetrics),
    [gscQueryMetrics],
  );

  const rankFluctuations = useMemo(
    () => buildRankFluctuations(localKeywordRows, keywordTargets, 5),
    [localKeywordRows, keywordTargets],
  );

  const loadEvaluation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/seo/ops/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordHealthRows: localKeywordRows,
          keywordHealthRefreshedAt: keywordRefreshedAt,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: SeoOpsEvaluation;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load SEO ops.");
      }
      setEvaluation(payload.evaluation ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load SEO ops.",
      );
    } finally {
      setLoading(false);
    }
  }, [client.id, localKeywordRows, keywordRefreshedAt]);

  useEffect(() => {
    void loadEvaluation();
  }, [loadEvaluation]);

  useEffect(() => {
    setLocalKeywordRows(keywordHealthRows);
    if (keywordHealthRows.length > 0) {
      setKeywordRefreshedAt(new Date().toISOString());
    }
  }, [keywordHealthRows]);

  useEffect(() => {
    if (page2Opportunities.length === 0) return;
    void fetch(`/api/seo/ops/${client.id}/items/${encodeURIComponent("monthly_gsc_page2")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewed: true, cadence: "monthly" }),
    });
  }, [client.id, page2Opportunities.length]);

  async function handleToggle(
    itemKey: string,
    cadence: SeoOpsCadence,
    done: boolean,
  ) {
    setBusyKey(itemKey);
    try {
      const response = await fetch(
        `/api/seo/ops/${client.id}/items/${encodeURIComponent(itemKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done, cadence }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: SeoOpsEvaluation;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update item.");
      }
      if (payload.evaluation) setEvaluation(payload.evaluation);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Failed to update item.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRefreshKeywordHealth() {
    if (!onLoadKeywordHealth) return;
    const rows = await onLoadKeywordHealth();
    setLocalKeywordRows(rows);
    setKeywordRefreshedAt(new Date().toISOString());
  }

  if (loading && !evaluation) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading SEO ops checklist…
      </div>
    );
  }

  if (error && !evaluation) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (!evaluation) {
    return (
      <p className="text-sm text-white/50">SEO ops checklist unavailable for this client.</p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-white/[0.08] bg-bip-page p-4">
        <h3 className="text-sm font-semibold text-white">Snapshot</h3>
        <p className="mt-1 text-xs text-white/50">
          GSC last synced:{" "}
          {gscSnapshotUpdatedAt
            ? new Date(gscSnapshotUpdatedAt).toLocaleDateString()
            : "Never"}
          {" · "}
          Week {evaluation.weeklyPeriodKey} · Month {evaluation.monthlyPeriodKey}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/site-audit"
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs text-white/75 hover:bg-white/[0.06]"
          >
            Site Audit
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/content-qa"
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs text-white/75 hover:bg-white/[0.06]"
          >
            Pre-launch SEO / Content QA
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.08] bg-bip-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          This week (~30–45 min)
        </h3>
        <ProgressBar
          done={evaluation.weeklyDoneCount}
          total={evaluation.weeklyTotalCount}
        />
        <ul className="mt-3">
          {evaluation.weeklyItems
            .filter((item) => !item.skipped)
            .map((item) => (
              <ItemRow
                key={item.itemKey}
                item={item}
                busy={busyKey === item.itemKey}
                onToggle={handleToggle}
                onOpenTab={onOpenTab}
              />
            ))}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshKeywordHealth()}
            disabled={keywordHealthLoading || !onLoadKeywordHealth}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {keywordHealthLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Refresh keyword health for rank scan
          </button>
        </div>
        {rankFluctuations.length > 0 && (
          <div className="mt-3 overflow-auto rounded-lg border border-white/[0.08]">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-bip-page">
                  <th className="px-2 py-2 font-semibold text-white/75">Keyword</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Prev</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Current</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Δ</th>
                </tr>
              </thead>
              <tbody>
                {rankFluctuations.slice(0, 8).map((row) => (
                  <tr key={row.keyword} className="border-b border-white/[0.08]">
                    <td className="px-2 py-2 text-white">{row.keyword}</td>
                    <td className="px-2 py-2 text-white/75">
                      {row.previousPosition?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-white/75">
                      {row.currentPosition?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-white/75">
                      {row.delta > 0 ? "+" : ""}
                      {row.delta.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-white/[0.08] bg-bip-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          This month (~2–3 hrs)
        </h3>
        <ProgressBar
          done={evaluation.monthlyDoneCount}
          total={evaluation.monthlyTotalCount}
        />
        <ul className="mt-3">
          {evaluation.monthlyItems
            .filter((item) => !item.skipped)
            .map((item) => (
              <ItemRow
                key={item.itemKey}
                item={item}
                busy={busyKey === item.itemKey}
                onToggle={handleToggle}
                onOpenTab={onOpenTab}
              />
            ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.08] bg-bip-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Page-2 opportunities (GSC positions 11–20)
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Low-hanging fruit from synced Search Console query data.
        </p>
        {page2Opportunities.length === 0 ? (
          <p className="mt-2 text-sm text-white/75">
            No page-2 queries yet. Sync GSC from the Reporting or SEO tab.
          </p>
        ) : (
          <div className="mt-2 overflow-auto rounded-lg border border-white/[0.08]">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-bip-page">
                  <th className="px-2 py-2 font-semibold text-white/75">Query</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Position</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Impressions</th>
                  <th className="px-2 py-2 font-semibold text-white/75">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {page2Opportunities.map((row) => (
                  <tr key={row.query} className="border-b border-white/[0.08]">
                    <td className="px-2 py-2 font-medium text-white">{row.query}</td>
                    <td className="px-2 py-2 text-white/75">{row.position.toFixed(1)}</td>
                    <td className="px-2 py-2 text-white/75">
                      {row.impressions.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-white/75">{row.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
