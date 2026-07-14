"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  GraduationCap,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import OnboardingIntakeDrawer from "@/components/onboarding/onboarding-intake-drawer";
import OnboardingWizard from "@/components/dashboard/onboarding-wizard";
import type {
  ClientOnboardingEvaluation,
  OnboardingQueueSummary,
} from "@/lib/clients/types";

type QueueResponse = {
  error?: string;
  summary?: OnboardingQueueSummary;
  clients?: ClientOnboardingEvaluation[];
};

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "warn" | "good" }) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300"
      : tone === "good"
        ? "text-emerald-400"
        : "text-bip-text";
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card px-4 py-3">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-bip-muted">{label}</p>
    </div>
  );
}

export default function OnboardingSection() {
  const router = useRouter();
  const [summary, setSummary] = useState<OnboardingQueueSummary | null>(null);
  const [queue, setQueue] = useState<ClientOnboardingEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clients/onboarding?status=active", { cache: "no-store" });
      const payload = (await res.json()) as QueueResponse;
      if (!res.ok) throw new Error(payload.error ?? "Failed to load onboarding queue");
      const clients = payload.clients ?? [];
      setSummary(payload.summary ?? null);
      setQueue(clients);
      setSelectedId((prev) =>
        prev != null && clients.some((c) => c.clientId === prev)
          ? prev
          : clients[0]?.clientId ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load onboarding queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = queue.find((c) => c.clientId === selectedId) ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-bip-text">Onboarding</h1>
          <p className="text-sm text-bip-muted">
            Everyone mid-onboarding. Pick a client to walk the steps, or add a new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add new client
        </button>
      </header>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="In onboarding" value={summary.inOnboarding} />
          <StatChip label="Setup blocked" value={summary.setupBlocked} tone={summary.setupBlocked > 0 ? "warn" : undefined} />
          <StatChip label="Comms overdue" value={summary.commsOverdue} tone={summary.commsOverdue > 0 ? "warn" : undefined} />
          <StatChip label="Ready to graduate" value={summary.readyToGraduate} tone={summary.readyToGraduate > 0 ? "good" : undefined} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-bip-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding queue…
        </div>
      ) : error ? (
        <p className="p-4 text-sm text-red-400">{error}</p>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bip-border p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-bip-muted" />
          <p className="text-sm text-bip-text">No clients are in onboarding right now.</p>
          <p className="mt-1 text-xs text-bip-muted">Add a new client to start the process.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Queue */}
          <div className="space-y-2">
            {queue.map((c) => {
              const isSel = c.clientId === selectedId;
              return (
                <button
                  key={c.clientId}
                  type="button"
                  onClick={() => setSelectedId(c.clientId)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    isSel
                      ? "border-bip-accent bg-bip-fill"
                      : "border-bip-border bg-bip-card hover:bg-bip-fill"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-bip-text">{c.accountName}</span>
                    <span className="shrink-0 text-xs text-bip-muted">{c.progressPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bip-border">
                    <div className="h-full rounded-full bg-bip-accent" style={{ width: `${c.progressPercent}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-bip-muted">
                      {c.marketingStrategist || "No strategist"}
                      {c.daysInOnboarding != null ? ` · Day ${c.daysInOnboarding}` : ""}
                    </span>
                    {c.commsCadence === "overdue" && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </span>
                    )}
                    {c.readyToGraduate && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        <GraduationCap className="h-3 w-3" /> Ready
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Wizard for the selected client */}
          <div>
            {selected ? (
              <OnboardingWizard
                key={selected.clientId}
                clientId={selected.clientId}
                onGraduated={() => void load()}
                onOpenTab={(tab) =>
                  router.push(
                    `/dashboard/clients/${selected.clientId}?tab=${tab === "edit" ? "profile" : tab}`,
                  )
                }
                onEditClient={() =>
                  router.push(`/dashboard/clients/${selected.clientId}?tab=profile`)
                }
              />
            ) : (
              <p className="p-4 text-sm text-bip-muted">Select a client to walk their steps.</p>
            )}
          </div>
        </div>
      )}

      <OnboardingIntakeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(client) => {
          setDrawerOpen(false);
          setSelectedId(client.id);
          setLoading(true);
          void load();
        }}
      />
    </div>
  );
}
