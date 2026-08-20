"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CheckSquare,
  ExternalLink,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import AppHeaderActions, { ModuleHeaderLinks } from "@/components/layout/app-header-actions";
import type { UserEmailMessageRow } from "@/lib/gmail/types";

type View = "inbox" | "needs_action" | "high_priority" | "archived" | "deleted";

const VIEWS: Array<{ value: View; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "needs_action", label: "Needs action" },
  { value: "high_priority", label: "High priority" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted" },
];

// Gmail opens a conversation directly by its thread id, which is why this page
// never needs send access — anything beyond triage hands off to Gmail.
function gmailThreadUrl(threadId: string) {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function PriorityBadge({ row }: { row: UserEmailMessageRow }) {
  if (row.ai_priority !== "high" && !row.is_high_priority) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
      <TriangleAlert className="h-2.5 w-2.5" aria-hidden />
      High
    </span>
  );
}

export default function InboxManager({ userEmail }: { userEmail?: string }) {
  const [view, setView] = useState<View>("inbox");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserEmailMessageRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [acting, setActing] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectMeta, setConnectMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (nextView: View = view) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/gmail/messages?view=${nextView}&limit=100`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { error?: string; rows?: UserEmailMessageRow[] };
        if (!response.ok) throw new Error(payload.error ?? "Could not load mail.");
        setRows(payload.rows ?? []);
        setSelectedId((current) =>
          payload.rows?.some((row) => row.id === current) ? current : (payload.rows?.[0]?.id ?? null),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load mail.");
      } finally {
        setLoading(false);
      }
    },
    [view],
  );

  const loadConnectStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/gmail/connect-status", { cache: "no-store" });
      const payload = await response.json();
      setConnected(Boolean(payload?.connected));
      setConnectMeta(payload?.email ?? payload?.message ?? null);
    } catch {
      setConnected(null);
    }
  }, []);

  useEffect(() => {
    void loadConnectStatus();
  }, [loadConnectStatus]);

  useEffect(() => {
    void loadMessages(view);
  }, [view, loadMessages]);

  const runSync = useCallback(
    async (full = false) => {
      setSyncing(true);
      setError(null);
      try {
        const response = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Sync failed.");
        await loadMessages(view);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "Sync failed.");
      } finally {
        setSyncing(false);
      }
    },
    [view, loadMessages],
  );

  const runAction = useCallback(
    async (action: string, value?: boolean) => {
      if (selectedId == null || acting) return;
      setActing(true);
      setError(null);
      try {
        const response = await fetch("/api/gmail/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: selectedId, action, value }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Action failed.");
        await loadMessages(view);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Action failed.");
      } finally {
        setActing(false);
      }
    },
    [selectedId, acting, view, loadMessages],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.subject, row.snippet, row.from_email, row.from_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, query]);

  const selected = filtered.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      <header className="flex shrink-0 items-center justify-between border-b border-bip-border bg-bip-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-bip-border bg-bip-card text-bip-text transition hover:bg-bip-page"
            title="Control panel"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <InboxIcon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-bip-text">Inbox</h1>
            <p className="text-xs text-bip-muted">
              {connected === false
                ? "Gmail not connected"
                : (connectMeta ?? userEmail ?? "Gmail triage")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModuleHeaderLinks />
          <AppHeaderActions />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mail…"
            className="min-w-52 flex-1 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text placeholder:text-bip-muted focus:outline-none focus:ring-1 focus:ring-bip-accent"
          />
          {connected === false ? (
            <a
              href="/api/gmail/oauth/start"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Connect Gmail
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void runSync(false)}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-page disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                Sync new
              </button>
              <button
                type="button"
                onClick={() => void runSync(true)}
                disabled={syncing}
                title="Pull the most recent ~300 inbox emails"
                className="rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm text-bip-text transition hover:bg-bip-page disabled:opacity-50"
              >
                Pull recent
              </button>
            </>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {VIEWS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setView(entry.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                view === entry.value
                  ? "border-bip-border bg-bip-fill text-bip-text"
                  : "border-bip-border bg-bip-card text-bip-muted hover:bg-bip-page"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
          {/* List */}
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-bip-border bg-bip-card">
            {loading ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-bip-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-bip-muted">
                Nothing in this view.
              </p>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full border-b border-bip-border px-3 py-2.5 text-left transition last:border-0 hover:bg-bip-page ${
                    row.id === selectedId ? "bg-bip-fill" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p
                      className={`min-w-0 flex-1 truncate text-sm ${
                        row.is_read ? "text-bip-text" : "font-semibold text-bip-text"
                      }`}
                    >
                      {row.from_name || row.from_email || "Unknown sender"}
                    </p>
                    <PriorityBadge row={row} />
                    <span className="shrink-0 text-[11px] text-bip-muted">
                      {formatDate(row.internal_date)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-bip-text">
                    {row.subject || "(no subject)"}
                  </p>
                  <p className="truncate text-[11px] text-bip-muted">{row.snippet}</p>
                </button>
              ))
            )}
          </div>

          {/* Reading pane */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-5">
            {!selected ? (
              <p className="text-sm text-bip-muted">Select a message.</p>
            ) : (
              <>
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-bip-border pb-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-bip-text">
                      {selected.subject || "(no subject)"}
                    </h2>
                    <p className="mt-1 text-xs text-bip-muted">
                      {selected.from_name || selected.from_email || "Unknown"}
                      {selected.from_name && selected.from_email
                        ? ` · ${selected.from_email}`
                        : ""}
                    </p>
                    <p className="text-xs text-bip-muted">
                      {selected.internal_date
                        ? new Date(selected.internal_date).toLocaleString()
                        : "No date"}
                    </p>
                    {selected.ai_priority_reason && (
                      <p className="mt-1 text-xs text-amber-500">
                        {selected.ai_priority_reason}
                      </p>
                    )}
                  </div>
                  <a
                    href={gmailThreadUrl(selected.gmail_thread_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-bip-border bg-bip-page px-3 py-1.5 text-xs text-bip-text transition hover:bg-bip-fill"
                  >
                    Open in Gmail
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {[
                    { action: "archive", label: "Archive", icon: Archive },
                    { action: "trash", label: "Delete", icon: Trash2 },
                    { action: "create_task", label: "To task", icon: CheckSquare },
                  ].map(({ action, label, icon: Icon }) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => void runAction(action)}
                      disabled={acting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-page px-3 py-1.5 text-xs text-bip-text transition hover:bg-bip-fill disabled:opacity-50"
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void runAction(selected.is_read ? "mark_unread" : "mark_read")}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-page px-3 py-1.5 text-xs text-bip-text transition hover:bg-bip-fill disabled:opacity-50"
                  >
                    {selected.is_read ? (
                      <Mail className="h-3 w-3" aria-hidden />
                    ) : (
                      <MailOpen className="h-3 w-3" aria-hidden />
                    )}
                    {selected.is_read ? "Mark unread" : "Mark read"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction(selected.is_starred ? "unstar" : "star")}
                    disabled={acting}
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-page px-3 py-1.5 text-xs transition hover:bg-bip-fill disabled:opacity-50 ${
                      selected.is_starred ? "text-amber-500" : "text-bip-text"
                    }`}
                  >
                    <Star
                      className={`h-3 w-3 ${selected.is_starred ? "fill-current" : ""}`}
                      aria-hidden
                    />
                    {selected.is_starred ? "Unstar" : "Star"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction("set_high_priority", !selected.is_high_priority)}
                    disabled={acting}
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-bip-border bg-bip-page px-3 py-1.5 text-xs transition hover:bg-bip-fill disabled:opacity-50 ${
                      selected.is_high_priority ? "text-amber-500" : "text-bip-text"
                    }`}
                  >
                    <TriangleAlert className="h-3 w-3" aria-hidden />
                    {selected.is_high_priority ? "Unflag" : "Flag important"}
                  </button>
                </div>

                <div className="max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-bip-text">
                  {selected.body_text || selected.snippet || "(empty message)"}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
