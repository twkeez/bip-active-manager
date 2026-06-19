"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import AppHeaderActions, { ModuleHeaderLinks } from "@/components/layout/app-header-actions";
import type { SeoOpsEvaluation, SeoOpsQueueSummary } from "@/lib/seo/ops/types";

type QueuePayload = {
  error?: string;
  summary?: SeoOpsQueueSummary;
  clients?: SeoOpsEvaluation[];
};

function ProgressCell({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  return (
    <span className={pct >= 100 ? "text-emerald-400" : "text-amber-400"}>
      {pct}%
    </span>
  );
}

export default function SeoOpsManager({ userEmail }: { userEmail?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SeoOpsQueueSummary | null>(null);
  const [clients, setClients] = useState<SeoOpsEvaluation[]>([]);
  const [mineOnly, setMineOnly] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = mineOnly ? "?mine=1" : "";
      const response = await fetch(`/api/seo/ops/queue${query}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as QueuePayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load SEO ops queue.");
      }
      setSummary(payload.summary ?? null);
      setClients(payload.clients ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [mineOnly]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const headline = useMemo(() => {
    if (!summary) return "SEO ops cadence";
    return `${summary.seoClientCount} SEO client${summary.seoClientCount === 1 ? "" : "s"} · ${summary.needsAttention} need attention`;
  }, [summary]);

  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      <header className="flex shrink-0 items-center justify-between border-b border-bip-border bg-bip-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-bip-border bg-bip-card text-bip-text transition hover:bg-bip-page"
            title="Control panel"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-bip-text">SEO Ops</h1>
            <p className="text-xs text-bip-muted">
              Weekly & monthly strategist checklist · {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleHeaderLinks />
          <AppHeaderActions />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-bip-text">{headline}</p>
            {summary && (
              <p className="mt-1 text-xs text-bip-muted">
                {summary.weeklyIncomplete} weekly incomplete ·{" "}
                {summary.monthlyIncomplete} monthly incomplete
              </p>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-bip-text">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="rounded border-bip-border"
            />
            My clients only
          </label>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-bip-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading queue…
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : clients.length === 0 ? (
          <p className="rounded-lg border border-bip-border bg-bip-card px-4 py-6 text-sm text-bip-text">
            No SEO-active clients in the queue.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-bip-border bg-bip-page text-xs uppercase tracking-wide text-bip-muted">
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Strategist</th>
                  <th className="px-4 py-3 font-semibold">Weekly</th>
                  <th className="px-4 py-3 font-semibold">Monthly</th>
                  <th className="px-4 py-3 font-semibold">Top blocker</th>
                  <th className="px-4 py-3 font-semibold">GSC sync</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((row) => (
                  <tr
                    key={row.clientId}
                    className="border-b border-bip-border last:border-0 hover:bg-bip-hover"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${row.clientId}?tab=seo_ops`}
                        className="font-medium text-bip-text hover:text-bip-accent"
                      >
                        {row.accountName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-bip-text">
                      {row.marketingStrategist ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ProgressCell
                        done={row.weeklyDoneCount}
                        total={row.weeklyTotalCount}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ProgressCell
                        done={row.monthlyDoneCount}
                        total={row.monthlyTotalCount}
                      />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-bip-muted">
                      {row.topBlockerHint ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-bip-muted">
                      {row.gscSnapshotUpdatedAt
                        ? new Date(row.gscSnapshotUpdatedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
