"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import type { RunPlan } from "@/lib/briefing-reminders/load-plan";

function runLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Step one of the scheduled reminders: what the next two runs would send,
 * before anything is sent. Nothing on this panel emails anyone.
 */
export default function ReminderPlan({ runs }: { runs: RunPlan[] }) {
  const [open, setOpen] = useState<string | null>(runs[0]?.date ?? null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ clientId: number; ok: boolean; message: string } | null>(null);

  async function sendTest(clientId: number) {
    setTesting(clientId);
    setTestResult(null);
    try {
      const res = await fetch("/api/briefing-reminders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; sentTo?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not send the test.");
      setTestResult({ clientId, ok: true, message: `Test sent to ${payload.sentTo}.` });
    } catch (err) {
      setTestResult({ clientId, ok: false, message: err instanceof Error ? err.message : "Could not send the test." });
    } finally {
      setTesting(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-bip-text">
          <CalendarClock size={16} /> Scheduled reminders · preview
        </h2>
        <p className="mt-1 text-xs text-bip-muted">
          One email per client to their strategist at 8am Eastern: first Monday of the month for every client with a
          marketing service, third Monday for everyone except Low Contact (those go to Tom and Alex). Each goes onto
          Follow-ups until marked complete. Nothing is sent until every nightly sync has finished that morning. The
          routine is <strong>switched off</strong> until you turn on &ldquo;Client update reminders&rdquo; on Coal
          Mines.
        </p>
      </div>

      {runs.map((run) => {
        const toTom = run.reminders.filter((r) => r.toFallback).length;
        const warned = run.reminders.filter((r) => r.warnings.length > 0).length;
        const isOpen = open === run.date;
        return (
          <div key={run.date} className="rounded-xl border border-bip-border bg-bip-card">
            <button
              onClick={() => setOpen(isOpen ? null : run.date)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-bip-text">
                  {runLabel(run.date)} · {run.slot === "first" ? "first-Monday run" : "third-Monday run"}
                </p>
                <p className="text-xs text-bip-muted">
                  {run.reminders.length} reminders · {run.reminders.length - toTom} to strategists · {toTom} to you (no
                  strategist on file)
                  {warned > 0 && <span className="text-amber-300"> · {warned} to check</span>}
                  {run.leftOut.length > 0 && <> · {run.leftOut.length} left out</>}
                </p>
              </div>
              <span className="text-xs text-bip-muted">{isOpen ? "Hide" : "Show"}</span>
            </button>

            {isOpen && (
              <div className="border-t border-bip-border">
                <ul className="divide-y divide-bip-border">
                  {run.reminders.map((r) => (
                    <li key={r.clientId} className="px-4 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/client-briefings?client=${r.clientId}`}
                          className="truncate text-sm text-bip-text hover:text-bip-accent"
                          title="Open this client's briefing above"
                        >
                          {r.accountName}
                        </Link>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-bip-muted">
                          {r.cadence === "monthly" ? "Low Contact · monthly" : "twice a month"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={`truncate text-xs ${r.toFallback ? "text-amber-300" : "text-bip-muted"}`}>
                          To {r.to.map((t) => t.name).join(" & ")}
                          {r.toFallback && " (you, as fallback)"}
                        </p>
                        <button
                          onClick={() => void sendTest(r.clientId)}
                          disabled={testing !== null}
                          className="shrink-0 text-[11px] text-bip-accent hover:underline disabled:opacity-50"
                          title="Email yourself this client's reminder exactly as it would go out, from today's data"
                        >
                          {testing === r.clientId ? "Sending…" : "Send me a test"}
                        </button>
                      </div>
                      {testResult?.clientId === r.clientId && (
                        <p className={`text-[11px] ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                          {testResult.message}
                        </p>
                      )}
                      {r.warnings.map((warning) => (
                        <p key={warning} className="flex items-start gap-1 text-[11px] text-amber-300/90">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {warning}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
                {run.leftOut.length > 0 && (
                  <div className="border-t border-bip-border px-4 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-bip-muted">Left out</p>
                    {run.leftOut.map((l) => (
                      <p key={l.clientId} className="truncate text-xs text-bip-muted">
                        {l.accountName}: {l.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
