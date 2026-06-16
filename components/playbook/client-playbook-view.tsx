"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ClientRow } from "@/lib/types/client";
import type { PlaybookItem, ServiceTier, VerifyResult } from "@/lib/playbook/types";
import { getClientTierKeys } from "@/lib/playbook/client-tiers";
import { runVerifications } from "@/lib/playbook/verify";
import ClientPlaybookTab from "./client-playbook-tab";

const VERIFY_KEYS = [
  "gsc_connected",
  "ads_synced",
  "ga4_connected",
  "gbp_connected",
  "basecamp_linked",
  "harvest_linked",
];

export default function ClientPlaybookView({ client }: { client: ClientRow }) {
  const [tiers, setTiers] = useState<ServiceTier[]>([]);
  const [itemsByTier, setItemsByTier] = useState<Record<string, PlaybookItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tierKeys = getClientTierKeys(client);
  const verificationsArray = runVerifications(VERIFY_KEYS, client);
  const verifications: Record<string, VerifyResult> = Object.fromEntries(
    verificationsArray.map((v) => [v.key, v]),
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tiersRes, itemsRes] = await Promise.all([
          fetch("/api/playbook/tiers"),
          fetch("/api/playbook/items"),
        ]);
        if (!tiersRes.ok || !itemsRes.ok) throw new Error("Failed to load playbook");
        const allTiers: ServiceTier[] = await tiersRes.json();
        const allItems: PlaybookItem[] = await itemsRes.json();

        const clientTiers = allTiers.filter((t) => tierKeys.includes(t.tier_key));
        const grouped: Record<string, PlaybookItem[]> = {};
        for (const item of allItems) {
          if (!tierKeys.includes(item.tier_key) || !item.is_active) continue;
          if (!grouped[item.tier_key]) grouped[item.tier_key] = [];
          grouped[item.tier_key].push(item);
        }
        setTiers(clientTiers);
        setItemsByTier(grouped);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[rgba(255,255,255,0.3)]" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-red-400">{error}</p>
    );
  }

  return (
    <ClientPlaybookTab
      tiers={tiers}
      itemsByTier={itemsByTier}
      verifications={verifications}
      clientName={client.account_name ?? "this client"}
    />
  );
}
