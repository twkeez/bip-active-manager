"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import BrandHeader from "@/components/vet-onboarding/brand-header";
import LocalRankGridPanel from "@/components/local-rank/local-rank-grid-panel";
import type { ClientRow } from "@/lib/types/client";

interface LocalRankManagerProps {
  clients: ClientRow[];
  userEmail?: string;
}

export default function LocalRankManager({ clients, userEmail }: LocalRankManagerProps) {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    clients[0]?.id ?? null,
  );

  useEffect(() => {
    if (!selectedClientId && clients[0]) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  return (
    <div className="min-h-screen bg-bip-page font-sans text-white/75">
      <BrandHeader />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bip-card px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Control Panel
          </Link>
          <p className="text-xs text-white/50">{userEmail ?? "Signed in"}</p>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-bip-accent" />
              <h1 className="text-2xl font-bold text-white">Local Grid Rank Tracker</h1>
            </div>
            <p className="text-sm text-white/50">
              Track local pack visibility across a 5×5 neighborhood grid for up to 3 keywords per
              scan.
            </p>
          </div>

          <section className="rounded-xl border border-white/[0.08] bg-bip-card p-4">
            <label className="block text-sm font-medium text-white/75">
              Client
              <select
                value={selectedClientId ?? ""}
                onChange={(event) => setSelectedClientId(Number(event.target.value))}
                className="mt-1.5 w-full rounded-lg border border-white/[0.12] bg-bip-page px-3 py-2.5 text-sm text-white"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.account_name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {selectedClient ? (
            <LocalRankGridPanel
              clientId={selectedClient.id}
              clientName={selectedClient.account_name}
              googlePlaceId={selectedClient.google_place_id}
            />
          ) : (
            <p className="rounded-xl border border-white/[0.08] bg-bip-card p-6 text-sm text-white/50">
              No clients available. Add a client from the dashboard first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
