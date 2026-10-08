"use client";

import { useCallback, useEffect, useState } from "react";

type Link = { id: number; created_at: string; created_by_email: string; revoked_at: string | null; last_viewed_at: string | null; view_count: number };
type State = { published_at: string | null; published_by: string | null; links: Link[]; portal_url: string | null };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "never";

/** Publish the snapshot the client sees, and manage their private links. Internal preview only. */
export default function PortalControls({ clientId, incomplete }: { clientId: number; incomplete: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{ url: string | null; path: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Your browser blocked copying. Use Open, then copy the address from the new tab.");
    }
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/client-snapshot/${clientId}`);
    const body = (await res.json().catch(() => ({}))) as State & { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) setError(body.error ?? `Could not load (HTTP ${res.status}).`);
    else setState(body);
  }, [clientId]);

  useEffect(() => {
    // Initial load; the effect re-runs only if the client changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/client-snapshot/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string | null; path?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Failed (HTTP ${res.status}).`);
      if (action === "create_link" && body.path) {
        setNewLink({ url: body.url ?? null, path: body.path });
        setCopied(false);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const button = "rounded-md border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text hover:bg-bip-hover disabled:opacity-50";
  const active = state?.links.filter((link) => !link.revoked_at) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-bip-border bg-bip-card px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-bip-muted">
          <span className="font-medium text-bip-text">What the client sees:</span>{" "}
          {state?.published_at
            ? `the snapshot published ${when(state.published_at)} by ${state.published_by?.split("@")[0]}`
            : "nothing yet (not published)"}
        </p>
        <button className={button} disabled={busy !== null || incomplete} onClick={() => void act("publish")}
          title={incomplete ? "Some data is incomplete; it can't be published until that's fixed." : "Freeze this page as what the client sees"}>
          {busy === "publish" ? "Publishing…" : state?.published_at ? "Publish this version" : "Publish"}
        </button>
      </div>

      <div className="space-y-2 border-t border-bip-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-bip-muted">
            <span className="font-medium text-bip-text">Private links</span> ({active.length} active)
          </p>
          <button className={button} disabled={busy !== null} onClick={() => void act("create_link")}>
            {busy === "create_link" ? "Creating…" : "Create private link"}
          </button>
        </div>
        {newLink && (
          <div className="space-y-1 rounded-md bg-bip-fill p-2">
            <p className="font-medium text-bip-text">Copy this link now. For safety it is stored scrambled and can&apos;t be shown again.</p>
            <code className="block select-all break-all text-bip-text">{newLink.url ?? newLink.path}</code>
            {newLink.url && (
              <div className="flex gap-2">
                <button className={button} onClick={() => void copyLink(newLink.url!)}>
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
                <a className={button} href={newLink.url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              </div>
            )}
            {!newLink.url && (
              <p className="text-bip-muted">The client site doesn&apos;t have its web address yet; once it does, the link is that address followed by the part above.</p>
            )}
          </div>
        )}
        {active.length > 0 && (
          <ul className="space-y-1">
            {active.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-bip-muted">
                  Created {when(link.created_at)} by {link.created_by_email.split("@")[0]} · viewed {link.view_count}{" "}
                  {link.view_count === 1 ? "time" : "times"}, last {when(link.last_viewed_at)}
                </span>
                <button className={button} disabled={busy !== null} onClick={() => void act("revoke_link", { linkId: link.id })}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-[var(--danger-fg)]">{error}</p>}
    </div>
  );
}
