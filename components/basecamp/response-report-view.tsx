"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, EyeOff, MessageSquare } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { openableBasecampUrl } from "@/lib/basecamp/display";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import type { BasecampProjectIgnoreRow } from "@/lib/clients/basecamp-project-ignores";
import {
  internalAuthors,
  OVERDUE_DAYS,
  shapeAndSort,
  summarizeReport,
  type ReportStatus,
  type ShapedReportRow,
} from "@/lib/basecamp/response-report";

type StatusFilter = "all" | ReportStatus;

const STOP_REASONS = ["No longer a client", "Internal / not a client project", "Other"] as const;

const STATUS_LABEL: Record<ReportStatus, string> = {
  awaiting_us: "Client spoke last",
  awaiting_client: "We spoke last",
  no_contact: "No messages",
};

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

function fmtDays(days: number | null): string {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
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
  days,
  url,
  title,
}: {
  who: string | null;
  at: string | null;
  days: number | null;
  url: string | null;
  title: string | null;
}) {
  const href = openableBasecampUrl(url);
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-bip-text">{who || <span className="text-bip-muted">Unattributed</span>}</p>
      <p className="text-xs text-bip-muted">
        {fmtDate(at)}
        {days != null && <span className="text-bip-muted/70"> · {fmtDays(days)} ago</span>}
      </p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-bip-accent hover:underline"
          title="Open this thread in Basecamp"
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
  lastSyncedAt,
  loadError,
}: {
  rows: ResponseReportRow[];
  ignored: BasecampProjectIgnoreRow[];
  lastSyncedAt: string | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");
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
    { key: "all", label: "All projects", count: summary.total },
    { key: "awaiting_us", label: "Waiting on us", count: summary.awaitingUs },
    { key: "awaiting_client", label: "Waiting on client", count: summary.awaitingClient },
    { key: "no_contact", label: "No messages", count: summary.noContact },
  ];

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
          <p className="text-sm text-bip-muted">
            {summary.awaitingUs === 0 ? (
              <span className="text-emerald-400">Nothing outstanding — every client message has a reply after it.</span>
            ) : (
              <>
                <span className="font-medium text-amber-300">
                  {summary.awaitingUs} {summary.awaitingUs === 1 ? "project is" : "projects are"} waiting on us
                </span>
                {summary.overdue > 0 && <> · {summary.overdue} for {OVERDUE_DAYS} days or more</>}.
              </>
            )}
          </p>

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

          <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
            {/* Fixed layout so the table fits the page: long names truncate
                instead of pushing the Basecamp button off-screen. */}
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col />
                <col />
                <col />
                <col className="w-36" />
                <col className="w-36" />
              </colgroup>
              <thead>
                <tr className="border-b border-bip-border text-[11px] uppercase tracking-wide text-bip-muted">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Last reply from us</th>
                  <th className="px-3 py-2 font-medium">Last message from client</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.basecamp_project_id}
                    className={`border-b border-bip-border last:border-0 hover:bg-bip-fill/50 ${r.acknowledged ? "opacity-60" : ""}`}
                  >
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      {r.client_id != null ? (
                        <Link
                          href={`/dashboard/clients/${r.client_id}`}
                          className="block truncate text-sm font-medium text-bip-text hover:text-bip-accent"
                        >
                          {r.account_name}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-bip-text">{r.account_name}</p>
                      )}
                      {r.client_id == null ? (
                        <p className="text-xs text-bip-muted">No client record</p>
                      ) : (
                        r.marketing_strategist && (
                          <p className="truncate text-xs text-bip-muted">{r.marketing_strategist}</p>
                        )
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <Side
                        who={r.last_internal_author}
                        at={r.last_internal_at}
                        days={r.days_since_our_reply}
                        url={r.last_internal_thread_url}
                        title={r.last_internal_thread_title}
                      />
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <Side
                        who={r.last_client_author}
                        at={r.last_client_at}
                        days={r.days_since_client_contact}
                        url={r.last_client_thread_url}
                        title={r.last_client_thread_title}
                      />
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.acknowledged && (
                        <span className="mt-1 block text-[10px] text-bip-muted">dismissed</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">
                      {confirming === r.basecamp_project_id ? (
                        <div className="space-y-1.5 text-left">
                          <p className="text-[11px] text-bip-muted">Stop tracking this project?</p>
                          <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-md border border-bip-border bg-bip-page px-1.5 py-1 text-[11px] text-bip-text"
                            aria-label="Why stop tracking"
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
                              {busy === r.basecamp_project_id ? "…" : "Stop"}
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
                        <div className="flex flex-col items-end gap-1">
                          <a
                            href={`https://basecamp.com/2175055/projects/${r.basecamp_project_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-bip-text"
                          >
                            <ExternalLink size={11} />
                            Basecamp
                          </a>
                          <button
                            onClick={() => {
                              setReason(STOP_REASONS[0]);
                              setConfirming(r.basecamp_project_id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text"
                            title="Hide this project from the report, Coal Mines and the reply watch. You can restore it below."
                          >
                            <EyeOff size={11} />
                            Stop tracking
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-bip-muted">
                      No projects match those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {actionError && <p className="text-sm text-red-400">{actionError}</p>}

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
