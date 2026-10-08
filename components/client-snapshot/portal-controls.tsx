"use client";

import { useCallback, useEffect, useState } from "react";

type Send = {
  id: number;
  recipients: string[];
  status: "sent" | "failed";
  error: string | null;
  sent_at: string;
  sent_by_email: string;
};
type Link = {
  id: number;
  kind: "manual" | "email";
  created_at: string;
  created_by_email: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
};
type State = {
  published_at: string | null;
  published_by: string | null;
  links: Link[];
  portal_url: string | null;
  recipients: string[];
  sends: Send[];
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      })
    : "never";

/** Publish the snapshot the client sees, and manage their private links. Internal preview only. */
export default function PortalControls({
  clientId,
  incomplete,
}: {
  clientId: number;
  incomplete: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{
    url: string | null;
    path: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [recipientsDraft, setRecipientsDraft] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function copyLink(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError(
        "Your browser blocked copying. Use Open, then copy the address from the new tab.",
      );
    }
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/client-snapshot/${clientId}`);
    const body = (await res.json().catch(() => ({}))) as State & {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || !body.ok)
      setError(body.error ?? `Could not load (HTTP ${res.status}).`);
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
    setNotice(null);
    try {
      const res = await fetch(`/api/client-snapshot/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        url?: string | null;
        path?: string;
        sent_to?: string[];
      };
      if (!res.ok || !body.ok)
        throw new Error(body.error ?? `Failed (HTTP ${res.status}).`);
      if (action === "send_email")
        setNotice(`Sent to ${(body.sent_to ?? []).join(", ")}.`);
      if (action === "set_recipients") setRecipientsDraft(null);
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

  const button =
    "rounded-md border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text hover:bg-bip-hover disabled:opacity-50";
  const active = state?.links.filter((link) => !link.revoked_at) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-bip-border bg-bip-card px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-bip-muted">
          <span className="font-medium text-bip-text">
            What the client sees:
          </span>{" "}
          {state?.published_at
            ? `the snapshot published ${when(state.published_at)} by ${state.published_by?.split("@")[0]}`
            : "nothing yet (not published)"}
        </p>
        <button
          className={button}
          disabled={busy !== null || incomplete}
          onClick={() => void act("publish")}
          title={
            incomplete
              ? "Some data is incomplete; it can't be published until that's fixed."
              : "Freeze this page as what the client sees"
          }
        >
          {busy === "publish"
            ? "Publishing…"
            : state?.published_at
              ? "Publish this version"
              : "Publish"}
        </button>
      </div>

      <div className="space-y-2 border-t border-bip-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-bip-muted">
            <span className="font-medium text-bip-text">Private links</span> (
            {active.length} active)
          </p>
          <button
            className={button}
            disabled={busy !== null}
            onClick={() => void act("create_link")}
          >
            {busy === "create_link" ? "Creating…" : "Create private link"}
          </button>
        </div>
        {newLink && (
          <div className="space-y-1 rounded-md bg-bip-fill p-2">
            <p className="font-medium text-bip-text">
              Copy this link now. For safety it is stored scrambled and
              can&apos;t be shown again.
            </p>
            <code className="block select-all break-all text-bip-text">
              {newLink.url ?? newLink.path}
            </code>
            {newLink.url && (
              <div className="flex gap-2">
                <button
                  className={button}
                  onClick={() => void copyLink(newLink.url!)}
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
                <a
                  className={button}
                  href={newLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              </div>
            )}
            {!newLink.url && (
              <p className="text-bip-muted">
                The client site doesn&apos;t have its web address yet; once it
                does, the link is that address followed by the part above.
              </p>
            )}
          </div>
        )}
        {active.length > 0 && (
          <ul className="space-y-1">
            {active.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-bip-muted">
                  {link.kind === "email" ? "Email link · " : ""}Created{" "}
                  {when(link.created_at)} by{" "}
                  {link.created_by_email.split("@")[0]} · viewed{" "}
                  {link.view_count} {link.view_count === 1 ? "time" : "times"},
                  last {when(link.last_viewed_at)}
                </span>
                <button
                  className={button}
                  disabled={busy !== null}
                  onClick={() => void act("revoke_link", { linkId: link.id })}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2 border-t border-bip-border pt-2">
        <p className="text-bip-muted">
          <span className="font-medium text-bip-text">Monthly email</span>: sent
          from your Gmail with the client&apos;s own link to the published
          snapshot. The same link goes out every month.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-md border border-bip-border bg-transparent px-2 py-1.5 text-xs text-bip-text"
            placeholder="Recipients, e.g. manager@clinic.com, owner@clinic.com"
            value={recipientsDraft ?? (state?.recipients ?? []).join(", ")}
            onChange={(event) => setRecipientsDraft(event.target.value)}
          />
          <button
            className={button}
            disabled={busy !== null || recipientsDraft === null}
            onClick={() =>
              void act("set_recipients", { recipients: recipientsDraft ?? "" })
            }
          >
            {busy === "set_recipients" ? "Saving…" : "Save recipients"}
          </button>
        </div>
        {confirmSend ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-bip-fill p-2">
            <span className="text-bip-text">
              Email the published snapshot to{" "}
              {(state?.recipients ?? []).join(", ")} now?
            </span>
            <button
              className={button}
              disabled={busy !== null}
              onClick={() => {
                setConfirmSend(false);
                void act("send_email");
              }}
            >
              Yes, send
            </button>
            <button className={button} onClick={() => setConfirmSend(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={button}
            disabled={
              busy !== null ||
              !state?.published_at ||
              !(state?.recipients.length ?? 0) ||
              recipientsDraft !== null
            }
            title={
              !state?.published_at
                ? "Publish first"
                : !(state?.recipients.length ?? 0)
                  ? "Add recipients first"
                  : "Send the snapshot email"
            }
            onClick={() => setConfirmSend(true)}
          >
            {busy === "send_email" ? "Sending…" : "Send snapshot email"}
          </button>
        )}
        {(state?.sends.length ?? 0) > 0 && (
          <ul className="space-y-0.5 text-bip-muted">
            {state!.sends.map((send) => (
              <li
                key={send.id}
                className={
                  send.status === "failed"
                    ? "text-[var(--danger-fg)]"
                    : undefined
                }
              >
                {send.status === "sent" ? "Sent" : "FAILED"}{" "}
                {when(send.sent_at)} by {send.sent_by_email.split("@")[0]} to{" "}
                {send.recipients.join(", ")}
                {send.error ? ` (${send.error})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      {notice && <p className="text-[var(--success-fg)]">{notice}</p>}
      {error && <p className="text-[var(--danger-fg)]">{error}</p>}
    </div>
  );
}
