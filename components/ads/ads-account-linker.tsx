"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Link2, Loader2, RefreshCw } from "lucide-react";
import type { AdsAccount } from "@/lib/ads/list-accounts";

/**
 * Attaching Google Ads accounts to the clients that are missing one.
 *
 * Every client here is paying for ads and getting no reporting, so the screen
 * is built for clearing a backlog: one row per client, the likely accounts
 * already found, one click to attach. The stored value is shown even when it is
 * a note somebody left ("Check on services"), because that note is the only
 * record of what the last person knew.
 */

type Needing = {
  clientId: number;
  accountName: string;
  stored: string | null;
  storedIsNote: boolean;
  suggestions: AdsAccount[];
};

type Payload = { accounts: AdsAccount[]; needing: Needing[]; unattached: AdsAccount[]; error?: string };

export default function AdsAccountLinker() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ads/accounts", { cache: "no-store" });
        const payload = (await response.json()) as Payload;
        if (!live) return;
        if (!response.ok) throw new Error(payload.error ?? "Could not load ads accounts");
        setData(payload);
      } catch (loadError) {
        if (live) setError(loadError instanceof Error ? loadError.message : "Could not load ads accounts");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  async function attach(clientId: number, customerId: string) {
    setBusy(clientId);
    setError(null);
    try {
      const response = await fetch("/api/ads/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, customerId }),
      });
      const payload = (await response.json()) as { error?: string; customerId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not attach that account");
      setDone((current) => ({ ...current, [clientId]: payload.customerId ?? customerId }));
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "Could not attach that account");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading the accounts under our manager account…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <h1 className="text-lg font-semibold text-bip-text">Ads accounts</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-bip-muted">
          Clients paying for Google Ads with no account attached, so we report nothing for them. Pick the right
          account and attach it — the next nightly sync picks them up. Nothing is guessed for you: two practices in a
          group often share most of a name.
        </p>
        <button
          type="button"
          onClick={() => setReload((count) => count + 1)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-bip-border px-2.5 py-1 text-xs text-bip-text hover:bg-bip-fill"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reload
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {data && (
        <>
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
              {data.needing.length} clients need an account
            </p>
            <div className="mt-3 space-y-3">
              {data.needing.length === 0 && (
                <p className="text-sm text-bip-muted">Every ads client has an account attached.</p>
              )}
              {data.needing.map((client) => {
                const attached = done[client.clientId];
                const pick = chosen[client.clientId] ?? client.suggestions[0]?.customerId ?? "";
                return (
                  <div key={client.clientId} className="rounded-lg border border-bip-border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-bip-text">{client.accountName}</p>
                      {client.stored && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${
                            client.storedIsNote
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                              : "border-bip-border text-bip-muted"
                          }`}
                        >
                          {client.storedIsNote && <AlertTriangle className="h-3 w-3" />}
                          stored: {client.stored}
                        </span>
                      )}
                    </div>

                    {attached ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600">
                        <Check className="h-3.5 w-3.5" /> Attached {attached}. It will sync tonight.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={pick}
                          onChange={(event) =>
                            setChosen((current) => ({ ...current, [client.clientId]: event.target.value }))
                          }
                          className="min-w-72 rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none"
                        >
                          <option value="">Choose an account…</option>
                          {client.suggestions.map((account) => (
                            <option key={account.customerId} value={account.customerId}>
                              {account.name} · {account.customerId}
                              {account.status !== "ENABLED" ? ` (${account.status.toLowerCase()})` : ""}
                            </option>
                          ))}
                          {client.suggestions.length > 0 && <option disabled>──────────</option>}
                          {data.accounts.map((account) => (
                            <option key={`all-${account.customerId}`} value={account.customerId}>
                              {account.name} · {account.customerId}
                              {account.status !== "ENABLED" ? ` (${account.status.toLowerCase()})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!pick || busy === client.clientId}
                          onClick={() => void attach(client.clientId, pick)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === client.clientId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                          Attach
                        </button>
                        {client.suggestions.length === 0 && (
                          <span className="text-[11px] text-bip-muted">
                            No account matched this name — pick from the full list.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* The same gap from the other side: accounts we manage and report on for nobody. */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
              {data.unattached.length} accounts attached to no client
            </p>
            <p className="mt-1 text-[11px] text-bip-muted">
              We can see these under our manager account, but no client record points at them, so nothing reports on
              them. Some will be closed accounts; others are the missing half of the list above.
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {data.unattached.map((account) => (
                <li key={account.customerId} className="text-xs text-bip-muted">
                  <span className="text-bip-text">{account.name || "(unnamed)"}</span> · {account.customerId}
                  {account.status !== "ENABLED" ? ` · ${account.status.toLowerCase()}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
