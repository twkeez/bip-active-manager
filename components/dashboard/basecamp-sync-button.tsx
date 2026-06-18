"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

function formatSyncTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}

function KittScanner() {
  return (
    <div
      className="w-full overflow-hidden rounded-sm"
      style={{ height: 3, background: "var(--border)" }}
    >
      <style>{`
        @keyframes kitt {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(500%); }
          100% { transform: translateX(-100%); }
        }
        .kitt-beam {
          animation: kitt 1.4s ease-in-out infinite;
          width: 30%;
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, transparent, #ef4444, #ff6b6b, #ef4444, transparent);
          box-shadow: 0 0 8px 2px rgba(239,68,68,0.8);
        }
      `}</style>
      <div className="kitt-beam" />
    </div>
  );
}

export default function BasecampSyncButton({
  lastSyncedAt,
}: {
  lastSyncedAt: string | null | undefined;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/basecamp/sync", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Sync failed");
      } else {
        setSyncedAt(new Date().toISOString());
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {syncedAt && !syncing && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
            <RefreshCw size={11} />
            {formatSyncTime(syncedAt)}
          </span>
        )}
        {syncing && (
          <span className="text-xs text-[var(--text-subtle)]">Syncing…</span>
        )}
        <button
          onClick={() => void handleSync()}
          disabled={syncing}
          className="bip-btn-secondary py-1.5 px-3 text-xs disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync Basecamp"}
        </button>
      </div>

      {/* KITT scanner — only visible while syncing */}
      <div
        style={{
          width: 180,
          opacity: syncing ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        <KittScanner />
      </div>

      {error && (
        <p className="text-xs text-[var(--bip-danger)]">{error}</p>
      )}
    </div>
  );
}
