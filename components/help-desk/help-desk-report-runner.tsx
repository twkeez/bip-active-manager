"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2, Play } from "lucide-react";

type Step = "zendesk" | "categorize" | "report";

type Props = {
  zendeskConfigured: boolean;
  anthropicConfigured: boolean;
  serviceAccountEmail: string | null;
  sheetUrl: string;
  counts: { tickets: number; uncategorized: number; users: number; organizations: number };
  streams: { stream: string; caught_up: boolean; last_run_at: string | null; last_error: string | null }[];
  lastRun: { ran_at: string; ran_by: string | null; summary: Record<string, number | string> } | null;
};

const STEP_LABEL: Record<Step, string> = {
  zendesk: "Sync Zendesk",
  categorize: "Categorize tickets",
  report: "Write the Google Sheet",
};

/** Safety stop: a backfill that needs more rounds than this is stuck, not slow. */
const MAX_ROUNDS = 60;

export default function HelpDeskReportRunner(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Step | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const note = (line: string) => setLog((lines) => [...lines, `${new Date().toLocaleTimeString()}  ${line}`]);

  async function post(step: Step) {
    const response = await fetch("/api/help-desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error ?? `Request failed (${response.status})`);
    return payload;
  }

  /** Runs one step, repeating it until the server says it is done. */
  async function runStep(step: Step) {
    setBusy(step);
    note(`${STEP_LABEL[step]}…`);
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      const result = await post(step);
      if (step === "zendesk") {
        const paused = (result.streams ?? []).find((s: { pausedReason?: string }) => s.pausedReason);
        note(
          `Zendesk: ${result.counts.tickets} tickets, ${result.counts.users} people, ${result.counts.organizations} organizations` +
            (paused ? ` — ${paused.stream} paused (${paused.pausedReason})` : ""),
        );
      } else if (step === "categorize") {
        note(`Categorized ${result.categorized} this round; ${result.remaining} left.`);
      } else {
        const s = result.summary ?? {};
        note(
          `Sheet written: ${s.matchedTickets} of ${s.tickets} tickets matched, ${s.unmatchedRequesters} people unmatched` +
            (result.fixesSaved ? `, ${result.fixesSaved} fixes saved from the Unmatched tab` : "") +
            ".",
        );
      }
      if (result.done) return;
      // A rate-limit pause is Zendesk asking us to wait about a minute.
      if (step === "zendesk") await new Promise((resolve) => setTimeout(resolve, 20_000));
    }
    throw new Error(`${STEP_LABEL[step]} did not finish after ${MAX_ROUNDS} rounds.`);
  }

  async function run(steps: Step[]) {
    setError(null);
    try {
      for (const step of steps) await runStep(step);
      note("Done.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  const blocked = !props.zendeskConfigured;
  const streamLine = (name: string) => {
    const s = props.streams.find((row) => row.stream === name);
    if (!s) return "not synced yet";
    const when = s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "never";
    return `${s.caught_up ? "up to date" : "backfilling"} · last run ${when}${s.last_error ? ` · error: ${s.last_error}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-semibold text-bip-text">Help Desk Report</h1>
        <p className="mt-1 text-xs text-bip-muted">
          Zendesk tickets for every client on the Master Sheet, with their Package, Strategist
          and whether they are website-only: who writes in, what they ask for, how many tickets,
          and when they last wrote — plus their Basecamp contacts. Tickets are matched to practices by website
          address first, then by name; anything that does not match lands on the sheet&apos;s
          Unmatched tab for you to fix.
        </p>
        <a
          href={props.sheetUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-bip-accent hover:underline"
        >
          Open the report sheet <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      {(!props.zendeskConfigured || !props.anthropicConfigured) && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-3 text-xs text-bip-muted">
          {!props.zendeskConfigured && (
            <p>
              Zendesk is not connected. Add <code>ZENDESK_EMAIL</code> and <code>ZENDESK_API_TOKEN</code>{" "}
              (a Zendesk <strong>admin&apos;s</strong> email and an API token from Admin Center → Apps and
              integrations → APIs → Zendesk API) to the Vercel environment and redeploy.
            </p>
          )}
          {!props.anthropicConfigured && <p>ANTHROPIC_API_KEY is not set, so tickets cannot be categorized.</p>}
        </div>
      )}

      <section className="rounded-xl border border-bip-border bg-bip-card p-4 text-xs text-bip-muted">
        <div className="grid gap-1 sm:grid-cols-2">
          <div>Tickets synced: <span className="text-bip-text">{props.counts.tickets}</span></div>
          <div>Not yet categorized: <span className="text-bip-text">{props.counts.uncategorized}</span></div>
          <div>Zendesk people: <span className="text-bip-text">{props.counts.users}</span></div>
          <div>Zendesk organizations: <span className="text-bip-text">{props.counts.organizations}</span></div>
        </div>
        <ul className="mt-3 space-y-0.5">
          <li>Tickets: {streamLine("tickets")}</li>
          <li>People: {streamLine("users")}</li>
          <li>Organizations: {streamLine("organizations")}</li>
        </ul>
        {props.lastRun && (
          <p className="mt-3">
            Last sheet written {new Date(props.lastRun.ran_at).toLocaleString()}
            {props.lastRun.ran_by ? ` by ${props.lastRun.ran_by}` : ""}: {props.lastRun.summary.matchedTickets} of{" "}
            {props.lastRun.summary.tickets} tickets matched,{" "}
            {props.lastRun.summary.clientsWithTickets ?? props.lastRun.summary.websiteOnlyWithTickets} of{" "}
            {props.lastRun.summary.clients ?? props.lastRun.summary.websiteOnlyClients} clients have tickets.
          </p>
        )}
        {props.serviceAccountEmail && (
          <p className="mt-3">
            The sheet must be shared with <code>{props.serviceAccountEmail}</code> as an Editor.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || blocked}
          onClick={() => void run(["zendesk", "categorize", "report"])}
          className="inline-flex items-center gap-2 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-bip-page disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run everything
        </button>
        {(Object.keys(STEP_LABEL) as Step[]).map((step) => (
          <button
            key={step}
            type="button"
            disabled={busy !== null || (blocked && step !== "report")}
            onClick={() => void run([step])}
            className="rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:text-bip-text disabled:opacity-40"
          >
            {STEP_LABEL[step]}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-bip-muted">
        The first Zendesk sync pulls every ticket back to the start and can take several minutes —
        keep this tab open. Later runs only fetch what changed.
      </p>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>
      )}
      {log.length > 0 && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-bip-border bg-bip-card p-3 text-[11px] text-bip-muted">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
