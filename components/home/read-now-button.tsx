"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Reads one client for Client Watch now (POST /api/client-watch/[id]/read),
 * then reloads Home. One Claude request, recorded under "Client Watch" in AI
 * costs. A failure is shown here and also saved as a failed read.
 */
export default function ReadNowButton({ clientId, label }: { clientId: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/client-watch/${clientId}/read`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? `The read failed (${response.status}).`);
        return;
      }
      router.refresh();
    } catch (caught) {
      setError(`The read failed: ${(caught as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={read}
        disabled={busy}
        className="rounded-md border border-bip-border px-2.5 py-1 text-xs text-bip-text hover:bg-bip-hover disabled:opacity-50"
      >
        {busy ? "Reading… (up to a minute)" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
