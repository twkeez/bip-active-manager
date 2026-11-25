"use client";

// Moved from the old Cockpit screen (parked): connect or disconnect the
// signed-in person's own Google account. GA4 and Search Console syncs use it
// when connected and fall back to the shared service account otherwise.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function GoogleAccountConnect() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [working, setWorking] = useState(false);

  // Check connection on mount
  useEffect(() => {
    fetch("/api/google/connect-status")
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => setStatus(d.connected ? "connected" : "disconnected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  async function handleDisconnect() {
    setWorking(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setStatus("disconnected");
    setWorking(false);
  }

  return (
    <div className="bip-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-bip-text">Google Account</p>
          <p className="mt-0.5 text-xs text-bip-muted">
            {status === "loading"
              ? "Checking connection…"
              : status === "connected"
              ? "Connected — GA4 and Search Console syncs use your credentials"
              : "Not connected — syncs fall back to the shared service account"}
          </p>
        </div>
        <div className="shrink-0">
          {status === "loading" ? (
            <Loader2 size={16} className="animate-spin text-bip-subtle" />
          ) : status === "connected" ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={working}
                className="rounded-lg border border-bip-border bg-bip-card px-3 py-1.5 text-xs font-medium text-bip-muted hover:border-bip-border-strong hover:text-bip-text disabled:opacity-50 transition-colors"
              >
                {working ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <a
              href="/api/google/oauth/start"
              className="inline-flex items-center gap-1.5 rounded-lg bg-bip-accent px-3 py-1.5 text-xs font-medium text-bip-page hover:opacity-90 transition-colors"
            >
              Connect Google
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
