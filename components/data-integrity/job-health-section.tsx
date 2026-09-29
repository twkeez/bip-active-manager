import type { JobHealthRow, RunDot } from "@/lib/job-watch/job-health";

const STATUS: Record<RunDot["status"], { label: string; text: string; dot: string }> = {
  ok: { label: "Worked", text: "text-emerald-400", dot: "bg-emerald-500" },
  partial: { label: "Partly worked", text: "text-amber-400", dot: "bg-amber-500" },
  failed: { label: "Failed", text: "text-red-400", dot: "bg-red-500" },
  running: { label: "Running", text: "text-sky-400", dot: "bg-sky-500" },
};

function eastern(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function duration(ms: number | null): string {
  if (ms == null) return "";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Every scheduled job: when it last ran, how it went, what it did (the job's
 * own counts), and its last 14 runs at a glance. Anything the watchdog is
 * holding against a job (overdue, timed out, failing) is listed under it.
 */
export default function JobHealthSection({ rows, loginProblems }: { rows: JobHealthRow[]; loginProblems: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">Scheduled jobs · times Eastern</h2>
      {loginProblems.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loginProblems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <ul className="divide-y divide-bip-border rounded-xl border border-bip-border bg-bip-card">
        {rows.map((row) => {
          const last = row.lastRun;
          const status = last ? STATUS[last.status] : null;
          return (
            <li key={row.key} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[11rem_1fr_auto]">
              <div>
                <p className="text-sm font-medium text-bip-text">{row.name}</p>
                <p className="text-xs text-bip-muted">{row.schedule}</p>
              </div>
              <div className="min-w-0 text-sm">
                {last && status ? (
                  <>
                    <p>
                      <span className={`font-medium ${status.text}`}>{status.label}</span>
                      <span className="text-bip-muted">
                        {" "}
                        · {eastern(last.startedAt)}
                        {last.durationMs != null && <> · took {duration(last.durationMs)}</>}
                      </span>
                    </p>
                    {last.counts.length > 0 && <p className="text-bip-text">{last.counts.join(" · ")}</p>}
                    {last.summary && <p className="break-words text-xs text-bip-muted">{last.summary}</p>}
                  </>
                ) : (
                  <p className="text-bip-muted">No run recorded in the last 7 days.</p>
                )}
                {row.problems.map((problem) => (
                  <p key={problem} className="mt-1 text-xs text-red-300">
                    {problem}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-1 sm:justify-end" aria-label="Recent runs, newest first">
                {row.recent.map((dot) => (
                  <span
                    key={dot.id}
                    className={`h-2.5 w-2.5 rounded-full ${STATUS[dot.status].dot}`}
                    title={`${eastern(dot.startedAt)}: ${STATUS[dot.status].label}${dot.summary ? ` — ${dot.summary}` : ""}`}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
