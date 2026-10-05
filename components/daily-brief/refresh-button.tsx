"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/feedback";

/**
 * Rebuilds today's brief now. A full run reads every active client, so it can
 * take a minute or two; the button says so rather than looking stuck.
 */
export default function RefreshButton({ label = "Refresh now" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/daily-brief/refresh", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "The brief could not be rebuilt.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The brief could not be rebuilt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-card px-3 py-1.5 text-sm text-bip-text hover:bg-bip-hover disabled:opacity-60"
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
        {busy ? "Rebuilding… this can take a minute or two" : label}
      </button>
      {error && <p className="max-w-sm text-right text-xs text-red-300">{error}</p>}
    </div>
  );
}
