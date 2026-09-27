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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-bip-text">
          <CalendarClock size={16} /> Scheduled reminders · preview
        </h2>
        <p className="mt-1 text-xs text-bip-muted">
          One email per client to their strategist at 8am Eastern: first Monday of the month for every client with a
          marketing service, third Monday for everyone except Low Contact. Each becomes a follow-up. <strong>Not
          switched on yet</strong>: this shows what would go out.
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
                      <p className={`truncate text-xs ${r.toFallback ? "text-amber-300" : "text-bip-muted"}`}>
                        To {r.to.map((t) => t.name).join(" & ")}
                        {r.toFallback && " (you, as fallback)"}
                      </p>
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
