"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { calendarDate, whenEastern } from "@/lib/poobah/format";
import { BipStatusBadge, BipStatusLegend, matchesBipFilter, onboardingAccent, type BipFilter } from "@/components/poobah/bip-status";
import { POOBAH_NAME, type PoobahSummary } from "@/lib/poobah/types";

type ClientOption = { id: number; name: string };

/** The watch list: every watched client, most recently updated first, and a way to add one. */
export default function PoobahListView({
  watches,
  clients,
  loadError,
}: {
  watches: PoobahSummary[];
  clients: ClientOption[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<BipFilter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [unlinked, setUnlinked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchedClientIds = useMemo(() => new Set(watches.map((w) => w.client_id).filter(Boolean)), [watches]);
  const shown = watches.filter((watch) => matchesBipFilter(watch.bip_status, filter));
  const filterCounts: Record<BipFilter, number> = {
    all: watches.length,
    onboarding: watches.filter((watch) => matchesBipFilter(watch.bip_status, "onboarding")).length,
    active: watches.filter((watch) => matchesBipFilter(watch.bip_status, "active")).length,
  };
  const picked = clients.find((client) => client.name.toLowerCase() === query.trim().toLowerCase()) ?? null;

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/poobah-client-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: picked && !unlinked ? picked.id : query.trim(),
          status: status.trim() || null,
          allowUnlinked: unlinked,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; result?: { watch: { id: number } } };
      if (!res.ok || !payload.ok || !payload.result) throw new Error(payload.error ?? `Could not add (HTTP ${res.status}).`);
      router.push(`/client-watch/${payload.result.watch.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add.");
      setSaving(false);
    }
  }

  return (
    <ToolPage
      title={POOBAH_NAME}
      icon={Crown}
      maxWidth="5xl"
      description="Clients you are keeping a close eye on: a current status, open items, a running log and account basics for each. Claude can read and update this too. Every change records who made it and when, and nothing is ever deleted. (Separate from the daily Client watch routine.)"
      actions={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Watch a client
          </button>
        )
      }
    >
      {adding && (
        <div className="space-y-3 rounded-xl border border-bip-border bg-bip-card p-4">
          <label className="block text-sm text-bip-text">
            Client
            <input
              list="poobah-clients"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Start typing a client name"
              className="mt-1 w-full rounded-md border border-bip-border bg-transparent px-3 py-2 text-sm"
              autoFocus
            />
            <datalist id="poobah-clients">
              {clients
                .filter((client) => !watchedClientIds.has(client.id))
                .map((client) => (
                  <option key={client.id} value={client.name} />
                ))}
            </datalist>
          </label>
          <p className="text-xs text-bip-muted">
            {picked && !unlinked
              ? `Links to the BIP Control client "${picked.name}".`
              : unlinked
                ? "Watched on its own, not linked to a BIP Control client."
                : "Pick a client from the list, or tick the box below for someone who is not a client yet."}
          </p>
          <label className="flex items-center gap-2 text-sm text-bip-muted">
            <input type="checkbox" checked={unlinked} onChange={(event) => setUnlinked(event.target.checked)} />
            Not a BIP Control client (e.g. a prospect)
          </label>
          <label className="block text-sm text-bip-text">
            Current status <span className="text-bip-muted">(optional)</span>
            <textarea
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-bip-border bg-transparent px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-bip-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void add()}
              disabled={saving || !query.trim() || (!picked && !unlinked)}
              className="rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to watch list"}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadError ? (
        <ErrorState message={loadError} />
      ) : watches.length === 0 ? (
        <EmptyState icon={Crown} title="Nobody on the watch list yet" hint="Use “Watch a client” to add the first one." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Filter by BIP status">
              {(["all", "onboarding", "active"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    filter === key ? "border-bip-accent bg-bip-fill text-bip-text" : "border-bip-border text-bip-muted hover:text-bip-text"
                  }`}
                >
                  {key === "all" ? "All" : key === "onboarding" ? "Onboarding" : "Active"} ({filterCounts[key]})
                </button>
              ))}
            </div>
            <BipStatusLegend />
          </div>
          <p className="text-xs text-bip-muted">
            {filter === "all"
              ? `${watches.length} watched ${watches.length === 1 ? "client" : "clients"}, all shown`
              : `${shown.length} of ${watches.length} watched clients shown (${filter === "onboarding" ? "onboarding" : "active"} only)`}{" "}
            · most recently updated first
          </p>
          {shown.length === 0 ? (
            <p className="text-sm text-bip-muted">No watched clients match this filter.</p>
          ) : (
          <ul className="divide-y divide-bip-border overflow-hidden rounded-xl border border-bip-border bg-bip-card">
            {shown.map((watch) => (
              <li key={watch.id} className={onboardingAccent(watch.bip_status)}>
                <Link href={`/client-watch/${watch.id}`} className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-bip-hover sm:grid-cols-[14rem_1fr_auto]">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-bip-text">{watch.name}</span>
                      <BipStatusBadge status={watch.bip_status} />
                    </p>
                    <p className="text-xs text-bip-muted">updated {whenEastern(watch.updated_at)}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-bip-text">{watch.status ?? <span className="text-bip-muted">No status yet</span>}</p>
                  <div className="text-xs text-bip-muted sm:text-right">
                    <p className={watch.open_items ? "font-medium text-bip-text" : undefined}>
                      {watch.open_items} open {watch.open_items === 1 ? "item" : "items"}
                    </p>
                    <p>Last log: {calendarDate(watch.last_log_date)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </ToolPage>
  );
}
