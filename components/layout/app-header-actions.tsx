"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, Loader2, LogOut, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HEADER_MODULE_LINKS } from "@/lib/navigation/modules";
type AppHeaderActionsProps = {
  showConnectBasecamp?: boolean;
  showSyncBasecamp?: boolean;
  showSignOut?: boolean;
  onSyncComplete?: () => void;
};
export default function AppHeaderActions({
  showConnectBasecamp = true,
  showSyncBasecamp = true,
  showSignOut = true,
  onSyncComplete,
}: AppHeaderActionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [syncing, setSyncing] = useState(false);
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  async function handleSyncBasecamp() {
    setSyncing(true);
    try {
      const response = await fetch("/api/basecamp/sync", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Basecamp sync failed");
      }
      onSyncComplete?.();
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }
  return (
    <>
      
      {showConnectBasecamp ? (
        <a
          href="/api/basecamp/oauth/start"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-2 text-xs font-medium text-bip-text transition hover:bg-bip-card/60"
        >
          
          <Link2 className="h-3.5 w-3.5" /> Connect Basecamp
        </a>
      ) : null}
      {showSyncBasecamp ? (
        <button
          type="button"
          onClick={() => void handleSyncBasecamp()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-2 text-xs font-medium text-bip-text transition hover:bg-bip-card/60 disabled:opacity-60"
        >
          
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync Basecamp
        </button>
      ) : null}
      {showSignOut ? (
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-2 text-xs font-medium text-bip-text transition hover:bg-bip-card/60"
        >
          
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      ) : null}
    </>
  );
}
export function ModuleHeaderLinks() {
  return (
    <div className="hidden items-center gap-2 xl:flex">
      
      {HEADER_MODULE_LINKS.map((module) => (
        <Link
          key={module.id}
          href={module.href}
          className="rounded-lg border border-bip-border px-2.5 py-1.5 text-xs font-medium text-bip-text transition hover:bg-bip-page"
        >
          
          {module.label}
        </Link>
      ))}
    </div>
  );
}
