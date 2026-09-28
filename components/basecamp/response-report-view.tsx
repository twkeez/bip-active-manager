"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, ExternalLink, MessageSquare } from "lucide-react";
import NotifyStrategistDialog, { type StaffOption } from "@/components/basecamp/notify-strategist-dialog";
import RowActionsMenu, { type RowAction } from "@/components/basecamp/row-actions-menu";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { openableBasecampUrl } from "@/lib/basecamp/display";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import type { BasecampProjectIgnoreRow } from "@/lib/clients/basecamp-project-ignores";
import { isOverdue, openForLabel, type FollowupRow } from "@/lib/followups/followups";
import { resolveStrategistContacts } from "@/lib/onboarding/expectation-people";
import {
  groupByWait,
  internalAuthors,
  isDismissed,
  reportTiles,
  shapeAndSort,
  summarizeReport,
  WAIT_THRESHOLDS,
  waitTone,
  type ReportStatus,
  type ShapedReportRow,
  type StatusFilter,
  type WaitTone,
} from "@/lib/basecamp/response-report";

const COLUMN_COUNT = 6;

const WAIT_CLASS: Record<WaitTone, string> = {
  overdue: "bg-red-500/15 text-red-200",
  aging: "bg-amber-500/15 text-amber-100",
  fresh: "bg-bip-fill text-bip-muted",
};

function basecampProjectUrl(projectId: string): string {
  return `https://basecamp.com/2175055/projects/${projectId}`;
}

function waitLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

const STOP_REASONS = ["No longer a client", "Internal / not a client project", "Other"] as const;

const STATUS_LABEL: Record<ReportStatus, string> = {
  awaiting_us: "Client spoke last",
  awaiting_client: "We spoke last",
  no_contact: "No messages",
};

/**
 * The Basecamp history held goes back 180 days (the 2026-09-27 backfill). A
 * project with nothing in it but older activity on record is quiet, not
 * empty, and is labelled that way.
 */
const HISTORY_DAYS = 180;

function statusLabel(r: ShapedReportRow): string {
  if (r.status === "no_contact" && r.last_activity_at) return `No activity in ${HISTORY_DAYS} days`;
  return STATUS_LABEL[r.status];
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  awaiting_us: "bg-amber-500/10 text-amber-300",
  awaiting_client: "bg-emerald-500/10 text-emerald-400",
  no_contact: "bg-bip-fill text-bip-muted",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtSync(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Side({
  who,
  at,
  url,
  title,
}: {
  who: string | null;
  at: string | null;
  url: string | null;
  title: string | null;
}) {
  const href = openableBasecampUrl(url);
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-bip-text">
        {who || <span className="text-bip-muted">Unattributed</span>}
        {at && <span className="text-xs text-bip-muted"> · {fmtDate(at)}</span>}
      </p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex max-w-full items-center gap-1 text-xs text-bip-accent hover:underline"
          title={title?.trim() ? `${title.trim()} (opens in Basecamp)` : "Open this thread in Basecamp"}
        >
          <span className="truncate">{title?.trim() || "Open thread"}</span>
          <ExternalLink size={10} className="shrink-0" />
        </a>
      )}
    </div>
  );
}

export default function ResponseReportView({
  rows,
  ignored,
  staff,
  openFollowups,
  lastSyncedAt,
  loadError,
  initialStatus,
}: {
  /** From ?status= in the address; the page opens on "Waiting on us" otherwise. */
  initialStatus?: StatusFilter | null;
  rows: ResponseReportRow[];
  ignored: BasecampProjectIgnoreRow[];
  staff: StaffOption[];
  openFollowups: FollowupRow[];
  lastSyncedAt: string | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [status, setStatusState] = useState<StatusFilter>(initialStatus ?? "awaiting_us");
  const [showDismissed, setShowDismissed] = useState(false);
  // Keep the chosen tab in the address so a reload or a shared link keeps it,
  // without a navigation that would re-fetch the whole report.
  function setStatus(next: StatusFilter) {
    setStatusState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("status", next);
    window.history.replaceState(null, "", url);
  }
  const [author, setAuthor] = useState<string>("all");
  const [query, setQuery] = useState("");
  // Stop tracking: the row being confirmed, its reason, and rows hidden
  // locally while the server catches up.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(STOP_REASONS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [notifying, setNotifying] = useState<ShapedReportRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The newest open follow-up per project, for the "Asked …" tag.
  const followupByProject = useMemo(() => {
    const map = new Map<string, FollowupRow>();
    for (const followup of openFollowups) {
      const projectId = followup.basecamp_project_id;
      if (!projectId) continue;
      const current = map.get(projectId);
      if (!current || followup.sent_at > current.sent_at) map.set(projectId, followup);
    }
    return map;
  }, [openFollowups]);

  const staffProfiles = useMemo(
    () => staff.map((person) => ({ full_name: person.name, email: person.email })),
    [staff],
  );
  function suggestedRecipient(row: ShapedReportRow): string | null {
    return (
      resolveStrategistContacts(row.marketing_strategist, staffProfiles).find((contact) => contact.email)
        ?.email ?? null
    );
  }

  async function stopTracking(row: ResponseReportRow) {
    setBusy(row.basecamp_project_id);
    setActionError(null);
    try {
      const res = await fetch("/api/basecamp/projects/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: row.basecamp_project_id,
          projectName: row.basecamp_project_name,
          reason,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not stop tracking that project.");
      }
      setHidden((prev) => new Set(prev).add(row.basecamp_project_id));
      setConfirming(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not stop tracking that project.");
    } finally {
      setBusy(null);
    }
  }

  async function restore(projectId: string) {
    setBusy(projectId);
    setActionError(null);
    try {
      const res = await fetch("/api/basecamp/projects/ignore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not restore that project.");
      }
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not restore that project.");
    } finally {
      setBusy(null);
    }
  }

  const shaped = useMemo(
    () => shapeAndSort(rows.filter((row) => !hidden.has(row.basecamp_project_id))),
    [rows, hidden],
  );
  const summary = useMemo(() => summarizeReport(shaped), [shaped]);
  const tiles = useMemo(() => reportTiles(shaped), [shaped]);
  const authors = useMemo(() => internalAuthors(shaped), [shaped]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shaped.filter((r: ShapedReportRow) => {
      if (status !== "all" && r.status !== status) return false;
      if (author !== "all" && r.last_internal_author !== author) return false;
      if (
        needle &&
        !r.account_name.toLowerCase().includes(needle) &&
        !r.basecamp_project_name.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [shaped, status, author, query]);

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "awaiting_us", label: "Waiting on us", count: tiles.waitingOnUs },
    { key: "awaiting_client", label: "Waiting on client", count: summary.awaitingClient },
    { key: "no_contact", label: `No activity in ${HISTORY_DAYS} days`, count: summary.noContact },
    { key: "all", label: "All", count: summary.total },
  ];

  // Dismissed rows never sit among rows that need action: their own group.
  const activeRows = visible.filter((r) => !isDismissed(r));
  const dismissedRows = visible.filter((r) => isDismissed(r));
  const ageGroups = status === "awaiting_us" ? groupByWait(activeRows) : null;

  async function setDismissed(row: ShapedReportRow, dismiss: boolean) {
    if (row.client_id == null) return;
    setBusy(row.basecamp_project_id);
    setActionError(null);
    try {
      const res = await fetch("/api/basecamp/acknowledge", {
        method: dismiss ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: row.client_id, forOccurredAt: row.last_client_at }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? (dismiss ? "Could not dismiss." : "Could not undo the dismissal."));
      }
      setNotice(dismiss ? `${row.account_name} dismissed.` : `${row.account_name} is waiting on us again.`);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the dismissal.");
    } finally {
      setBusy(null);
    }
  }

  function rowActions(r: ShapedReportRow): RowAction[] {
    const noClient = r.client_id == null;
    const actions: RowAction[] = [
      { label: "Open in Basecamp", href: basecampProjectUrl(r.basecamp_project_id) },
    ];
    if (!noClient) actions.push({ label: "Open client page", onSelect: () => router.push(`/dashboard/clients/${r.client_id}`) });
    if (isDismissed(r)) {
      actions.push({ label: "Undo dismiss", onSelect: () => void setDismissed(r, false) });
    } else {
      actions.push({
        label: "Dismiss",
        onSelect: () => void setDismissed(r, true),
        disabled: noClient || r.status !== "awaiting_us",
        disabledReason: noClient
          ? "Dismiss is saved on the client record, and this project has none. Link it on Project Wiring, or use Stop tracking."
          : "Only a project waiting on us can be dismissed.",
      });
    }
    actions.push({
      label: "Stop tracking…",
      tone: "danger",
      onSelect: () => {
        setReason(STOP_REASONS[0]);
        setConfirming(r.basecamp_project_id);
      },
    });
    return actions;
  }

  function renderRow(r: ShapedReportRow) {
    const followup = followupByProject.get(r.basecamp_project_id);
    const now = new Date();
    return (
      <tr key={r.basecamp_project_id} className="border-b border-bip-border last:border-0 hover:bg-bip-fill/50">
        <td className="min-w-0 px-3 py-2 align-top">
          <a
            href={basecampProjectUrl(r.basecamp_project_id)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${r.account_name} (opens in Basecamp)`}
            className="block truncate text-sm font-medium text-bip-text hover:text-bip-accent"
          >
            {r.account_name}
          </a>
          <p className="truncate text-xs text-bip-muted">
            {r.client_id == null ? "No client record" : r.marketing_strategist || "\u00a0"}
          </p>
        </td>
        <td className="min-w-0 px-3 py-2 align-top">
          {r.waitingDays == null ? (
            <span className="text-xs text-bip-muted" title={r.last_activity_at ? "Last Basecamp activity" : undefined}>
              {r.last_activity_at ? `Last active ${fmtDate(r.last_activity_at)}` : "—"}
            </span>
          ) : (
            <span
              className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                WAIT_CLASS[r.status === "awaiting_us" && !r.acknowledged ? waitTone(r.waitingDays) : "fresh"]
              }`}
              title={
                r.status === "awaiting_us"
                  ? "Days since the client's last message"
                  : r.status === "awaiting_client"
                    ? "Days since our last reply"
                    : undefined
              }
            >
              {waitLabel(r.waitingDays)}
            </span>
          )}
          {followup && (
            <Link
              href="/follow-ups"
              title={`Follow-up sent to ${followup.recipient_email}`}
              className={`mt-1 block w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isOverdue(followup, now) ? "bg-red-500/15 text-red-200" : "bg-sky-500/15 text-sky-100"
              }`}
            >
              Asked {followup.recipient_name ?? followup.recipient_email} · {openForLabel(followup.sent_at, now)}
            </Link>
          )}
        </td>
        <td className="min-w-0 px-3 py-2 align-top">
          <Side
            who={r.last_internal_author}
            at={r.last_internal_at}
            url={r.last_internal_thread_url}
            title={r.last_internal_thread_title}
          />
        </td>
        <td className="min-w-0 px-3 py-2 align-top">
          <Side
            who={r.last_client_author}
            at={r.last_client_at}
            url={r.last_client_thread_url}
            title={r.last_client_thread_title}
          />
        </td>
        <td className="min-w-0 px-3 py-2 align-top">
          <span
            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[r.status]}`}
          >
            {statusLabel(r)}
          </span>
        </td>
        <td className="px-3 py-2 text-right align-top">
          {confirming === r.basecamp_project_id ? (
            <div className="space-y-1.5 text-left" role="group" aria-label={`Stop tracking ${r.account_name}`}>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-bip-border bg-bip-page px-1.5 py-1 text-[11px] text-bip-text"
                aria-label="Why stop tracking"
                autoFocus
              >
                {STOP_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button
                  onClick={() => void stopTracking(r)}
                  disabled={busy === r.basecamp_project_id}
                  className="flex-1 rounded-md bg-bip-accent px-2 py-1 text-[11px] font-medium text-black disabled:opacity-50"
                >
                  {busy === r.basecamp_project_id ? "…" : "Stop tracking"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 rounded-md border border-bip-border px-2 py-1 text-[11px] text-bip-muted hover:text-bip-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => {
                  setNotice(null);
                  setNotifying(r);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-bip-border px-2 text-xs text-bip-text hover:border-bip-accent"
                title="Email a teammate about this client and track it on Follow-ups"
              >
                <BellRing size={12} />
                Notify
              </button>
              <RowActionsMenu actions={rowActions(r)} label={`More actions for ${r.account_name}`} />
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <ToolPage
      title="Basecamp Response Report"
      icon={MessageSquare}
      maxWidth="6xl"
      description={`Every Basecamp project with who spoke last, when we last replied and who replied, and when the client last reached out. ${summary.total} projects · last sync ${fmtSync(lastSyncedAt)}.`}
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          <StatTiles>
            <StatTile label="Waiting on us" value={tiles.waitingOnUs} />
            <StatTile
              label={`Waiting ${WAIT_THRESHOLDS.overdueDays}+ days`}
              value={tiles.waitingOverdue}
              tone={tiles.waitingOverdue > 0 ? "danger" : undefined}
            />
            <StatTile
              label="Oldest wait"
              value={tiles.oldest ? waitLabel(tiles.oldest.days) : "—"}
              sub={tiles.oldest?.name}
            />
            <StatTile label="Waiting on client" value={tiles.waitingOnClient} />
          </StatTiles>

          {actionError && <p className="text-sm text-red-400">{actionError}</p>}
          {notice && (
            <p className="text-sm text-emerald-400">
              {notice}{" "}
              <Link href="/follow-ups" className="underline">
                See follow-ups
              </Link>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  status === f.key
                    ? "border-bip-accent text-bip-text"
                    : "border-bip-border text-bip-muted hover:text-bip-text"
                }`}
              >
                {f.label} <span className="tabular-nums text-bip-muted">{f.count}</span>
              </button>
            ))}

            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="rounded-md border border-bip-border bg-bip-card px-2 py-1 text-xs text-bip-text"
              aria-label="Filter by who replied last"
            >
              <option value="all">Anyone on our side</option>
              {authors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="rounded-md border border-bip-border bg-bip-card px-2 py-1 text-xs text-bip-text placeholder:text-bip-muted"
            />
          </div>

          {/* Its own scroll area, so the header can stay put while the rows scroll
              and a narrow screen scrolls the table sideways, not the page. */}
          <div className="max-h-[calc(100vh-16rem)] overflow-auto rounded-xl border border-bip-border bg-bip-card">
            {/* Fixed layout so the table fits the page: long names truncate
                instead of pushing the Basecamp button off-screen. */}
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col />
                <col className="w-24" />
                <col />
                <col />
                <col className="w-36" />
                <col className="w-32" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-bip-card shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <tr className="border-b border-bip-border text-[11px] uppercase tracking-wide text-bip-muted">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Waiting</th>
                  <th className="px-3 py-2 font-medium">Last reply from us</th>
                  <th className="px-3 py-2 font-medium">Last message from client</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ageGroups
                  ? ageGroups.map((group) => (
                      <Fragment key={group.label}>
                        <tr className="border-b border-bip-border bg-bip-fill/40">
                          <td colSpan={COLUMN_COUNT} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
                            <span className={group.tone === "overdue" ? "text-red-200" : group.tone === "aging" ? "text-amber-100" : "text-bip-muted"}>
                              {group.label}
                            </span>{" "}
                            <span className="tabular-nums text-bip-muted">· {group.rows.length}</span>
                          </td>
                        </tr>
                        {group.rows.map((r) => renderRow(r))}
                      </Fragment>
                    ))
                  : activeRows.map((r) => renderRow(r))}
                {activeRows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-sm text-bip-muted">
                      No projects match those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {dismissedRows.length > 0 && (
            <div className="rounded-xl border border-bip-border bg-bip-card">
              <button
                onClick={() => setShowDismissed((open) => !open)}
                aria-expanded={showDismissed}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-bip-muted hover:text-bip-text"
              >
                <span>
                  Dismissed <span className="tabular-nums">({dismissedRows.length})</span>
                  <span className="ml-2 text-xs">client spoke last, marked as needing no reply</span>
                </span>
                <span className="text-xs">{showDismissed ? "Hide" : "Show"}</span>
              </button>
              {showDismissed && (
                <div className="overflow-x-auto border-t border-bip-border">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col />
                      <col className="w-24" />
                      <col />
                      <col />
                      <col className="w-36" />
                      <col className="w-32" />
                    </colgroup>
                    <tbody>{dismissedRows.map((r) => renderRow(r))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {notifying && (
            <NotifyStrategistDialog
              row={notifying}
              staff={staff}
              suggestedEmail={suggestedRecipient(notifying)}
              onClose={() => setNotifying(null)}
              onSent={() => {
                setNotice(`Sent. ${notifying.account_name} is now on your follow-up list.`);
                setNotifying(null);
                router.refresh();
              }}
            />
          )}

          {ignored.length > 0 && (
            <div className="rounded-xl border border-bip-border bg-bip-card">
              <button
                onClick={() => setShowIgnored((open) => !open)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-bip-muted hover:text-bip-text"
              >
                <span>
                  Not tracked <span className="tabular-nums">({ignored.length})</span>
                </span>
                <span className="text-xs">{showIgnored ? "Hide" : "Show"}</span>
              </button>
              {showIgnored && (
                <ul className="border-t border-bip-border">
                  {ignored.map((row) => (
                    <li
                      key={row.basecamp_project_id}
                      className="flex items-center justify-between gap-3 border-b border-bip-border px-4 py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-bip-text">{row.project_name}</p>
                        <p className="truncate text-xs text-bip-muted">
                          {[row.reason, row.ignored_by, fmtDate(row.ignored_at)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <button
                        onClick={() => void restore(row.basecamp_project_id)}
                        disabled={busy === row.basecamp_project_id}
                        className="shrink-0 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-bip-text disabled:opacity-50"
                      >
                        {busy === row.basecamp_project_id ? "…" : "Restore"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </ToolPage>
  );
}
