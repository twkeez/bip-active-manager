"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { openableBasecampUrl } from "@/lib/basecamp/display";
import type { ResponseReportRow } from "@/lib/basecamp/load-response-report";
import {
  internalAuthors,
  OVERDUE_DAYS,
  shapeAndSort,
  summarizeReport,
  type ReportStatus,
  type ShapedReportRow,
} from "@/lib/basecamp/response-report";

type StatusFilter = "all" | ReportStatus;

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
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-bip-text" title={title ?? undefined}>
            {fmtDate(at)}
          </a>
        ) : (
          fmtDate(at)
        )}
        {days != null && <span className="text-bip-muted/70"> · {fmtDays(days)} ago</span>}
      </p>
    </div>
  );
}

export default function ResponseReportView({
  rows,
  lastSyncedAt,
  loadError,
}: {
  rows: ResponseReportRow[];
  lastSyncedAt: string | null;
  loadError: string | null;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [author, setAuthor] = useState<string>("all");
  const [query, setQuery] = useState("");

  const shaped = useMemo(() => shapeAndSort(rows), [rows]);
  const summary = useMemo(() => summarizeReport(shaped), [shaped]);
  const authors = useMemo(() => internalAuthors(shaped), [shaped]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return shaped.filter((r: ShapedReportRow) => {
      if (status !== "all" && r.status !== status) return false;
      if (author !== "all" && r.last_internal_author !== author) return false;
      if (needle && !r.account_name.toLowerCase().includes(needle)) return false;
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
            <table className="w-full min-w-[52rem] text-left">
              <thead>
                <tr className="border-b border-bip-border text-[11px] uppercase tracking-wide text-bip-muted">
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Last reply from us</th>
                  <th className="px-4 py-2 font-medium">Last message from client</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.client_id}
                    className={`border-b border-bip-border last:border-0 hover:bg-bip-fill/50 ${r.acknowledged ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/clients/${r.client_id}`}
                        className="truncate text-sm font-medium text-bip-text hover:text-bip-accent"
                      >
                        {r.account_name}
                      </Link>
                      {r.marketing_strategist && (
                        <p className="text-xs text-bip-muted">{r.marketing_strategist}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Side
                        who={r.last_internal_author}
                        at={r.last_internal_at}
                        days={r.days_since_our_reply}
                        url={r.last_internal_thread_url}
                        title={r.last_internal_thread_title}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Side
                        who={r.last_client_author}
                        at={r.last_client_at}
                        days={r.days_since_client_contact}
                        url={r.last_client_thread_url}
                        title={r.last_client_thread_title}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.acknowledged && (
                        <span className="ml-1 text-[10px] text-bip-muted">dismissed</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.basecamp_project_id && (
                        <a
                          href={`https://basecamp.com/2175055/projects/${r.basecamp_project_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-bip-text"
                        >
                          <ExternalLink size={11} />
                          Basecamp
                        </a>
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
        </>
      )}
    </ToolPage>
  );
}
