"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ListChecks } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { FOLLOWUP_OVERDUE_HOURS, isOverdue, openForLabel, type FollowupRow } from "@/lib/followups/followups";

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tookLabel(from: string, to: string | null): string {
  if (!to) return "";
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

export default function FollowupsView({
  open,
  done,
  loadError,
}: {
  open: FollowupRow[];
  done: FollowupRow[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const overdueCount = open.filter((f) => isOverdue(f, now)).length;

  async function act(id: number, action: "done" | "reopen") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not update the follow-up.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the follow-up.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ToolPage
      title="Follow-ups"
      icon={ListChecks}
      maxWidth="5xl"
      description={`Notes sent to strategists from the Response Report. Each closes on its own only when the person you asked replies in that Basecamp thread (or, for a note with no thread, posts in the project), or when marked done. After ${FOLLOWUP_OVERDUE_HOURS / 24} days open, they get one reminder and it appears in your morning email every day until it closes.`}
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          <p className="text-sm text-bip-muted">
            {open.length === 0 ? (
              <span className="text-emerald-400">Nothing open. Every follow-up has been taken care of.</span>
            ) : (
              <>
                <span className="font-medium text-bip-text">{open.length} open</span>
                {overdueCount > 0 && (
                  <span className="text-red-400"> · {overdueCount} open for {FOLLOWUP_OVERDUE_HOURS / 24} days or more</span>
                )}
              </>
            )}
            {" · "}
            <Link href="/response-report" className="text-bip-accent hover:underline">
              Response Report
            </Link>
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {open.length > 0 && (
            <ul className="divide-y divide-bip-border rounded-xl border border-bip-border bg-bip-card">
              {open.map((f) => {
                const overdue = isOverdue(f, now);
                return (
                  <li key={f.id} className={`flex items-start gap-4 px-4 py-3 ${overdue ? "bg-red-500/5" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-bip-text">
                        {f.client_id != null ? (
                          <Link href={`/dashboard/clients/${f.client_id}`} className="hover:text-bip-accent">
                            {f.project_name}
                          </Link>
                        ) : (
                          f.project_name
                        )}
                      </p>
                      <p className="text-xs text-bip-muted">
                        Asked {f.recipient_name ?? f.recipient_email} · {fmtDateTime(f.sent_at)}
                        {f.renudged_at && <> · reminder sent {fmtDateTime(f.renudged_at)}</>}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-bip-muted/80">{f.note}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        {f.thread_url && (
                          <a href={f.thread_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-bip-accent hover:underline">
                            {f.thread_title || "Thread"} <ExternalLink size={10} />
                          </a>
                        )}
                        <a
                          href={`https://basecamp.com/2175055/projects/${f.basecamp_project_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-bip-muted hover:text-bip-text"
                        >
                          Basecamp project <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          overdue ? "bg-red-500/15 text-red-300" : "bg-sky-500/10 text-sky-300"
                        }`}
                      >
                        Open {openForLabel(f.sent_at, now)}
                      </span>
                      <button
                        onClick={() => void act(f.id, "done")}
                        disabled={busy === f.id}
                        className="rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-bip-text disabled:opacity-50"
                        title="Handled another way, e.g. by phone"
                      >
                        {busy === f.id ? "…" : "Mark done"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">Taken care of · last 30 days</h2>
              <ul className="divide-y divide-bip-border rounded-xl border border-bip-border bg-bip-card">
                {done.map((f) => (
                  <li key={f.id} className="flex items-center gap-4 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-bip-text">{f.project_name}</p>
                      <p className="truncate text-xs text-bip-muted">
                        Asked {f.recipient_name ?? f.recipient_email} {fmtDateTime(f.sent_at)} ·{" "}
                        {f.resolution === "we_posted"
                          ? `${f.resolved_by ?? "They"} replied in Basecamp`
                          : `marked done by ${f.resolved_by ?? "someone"}`}{" "}
                        after {tookLabel(f.sent_at, f.resolved_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => void act(f.id, "reopen")}
                      disabled={busy === f.id}
                      className="shrink-0 text-xs text-bip-muted hover:text-bip-text disabled:opacity-50"
                    >
                      {busy === f.id ? "…" : "Reopen"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ToolPage>
  );
}
