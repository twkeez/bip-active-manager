"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReportStateBadge } from "@/components/reporting/report-state-badge";
import {
  monthLabel,
  SENT_VIA,
  SENT_VIA_LABELS,
  type MonthKey,
  type ReportState,
  type SentVia,
  type StoredReportState,
} from "@/lib/reporting/monthly";

export type MonthStatus = {
  state: ReportState;
  sentVia: SentVia[];
  updatedAt: string | null;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

/**
 * The strip across the top of a client's report: which month it's for, where it
 * stands, and the button that moves it on. Saves through
 * /api/reports/[clientId]/month, then reloads the page so every count agrees.
 */
export default function MonthStatusBar({
  clientId,
  month,
  status,
  tracked,
  problem,
}: {
  clientId: number;
  month: MonthKey;
  status: MonthStatus;
  /** False until monthly_reports exists. */
  tracked: boolean;
  /** Why the state couldn't be read, if it couldn't. */
  problem: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosingVia, setChoosingVia] = useState(false);
  const [via, setVia] = useState<SentVia[]>([]);
  const label = monthLabel(month);

  async function move(next: StoredReportState, sentVia: SentVia[] = []) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${clientId}/month`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, status: next, sentVia }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? `Could not save (${response.status}).`);
        return;
      }
      setChoosingVia(false);
      setVia([]);
      router.refresh();
    } catch (caught) {
      setError(`Could not save: ${(caught as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const button = "rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  const primary = `${button} bg-bip-accent text-white`;
  const quiet = `${button} border border-bip-border text-bip-text hover:bg-bip-hover`;

  return (
    <div className="shrink-0 space-y-2 border-b border-bip-border bg-bip-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-bip-text">{label} report</span>
        {problem ? (
          <span className="text-bip-danger">{problem}</span>
        ) : !tracked ? (
          <span className="text-bip-muted">States can&apos;t be saved until the Reporting database step is run.</span>
        ) : (
          <>
            <ReportStateBadge state={status.state} />
            {status.updatedAt && (
              <span className="text-xs text-bip-muted">
                {shortDate(status.updatedAt)}
                {status.sentVia.length > 0 && ` · ${status.sentVia.map((v) => SENT_VIA_LABELS[v]).join(", ")}`}
              </span>
            )}
            <span className="flex flex-wrap gap-2">
              {status.state === "not_started" && (
                <button type="button" className={primary} disabled={saving} onClick={() => move("draft")}>
                  Start draft
                </button>
              )}
              {status.state === "draft" && (
                <button type="button" className={primary} disabled={saving} onClick={() => move("reviewed")}>
                  Mark reviewed
                </button>
              )}
              {status.state === "reviewed" && !choosingVia && (
                <button type="button" className={primary} disabled={saving} onClick={() => setChoosingVia(true)}>
                  Mark sent
                </button>
              )}
              {(status.state === "reviewed" || status.state === "sent") && !choosingVia && (
                <button type="button" className={quiet} disabled={saving} onClick={() => move("draft")}>
                  Back to draft
                </button>
              )}
            </span>
          </>
        )}
      </div>

      {choosingVia && (
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">How the report was sent</legend>
          <span className="text-bip-muted">How did it go to the client?</span>
          {SENT_VIA.map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-bip-text">
              <input
                type="checkbox"
                checked={via.includes(option)}
                onChange={(event) =>
                  setVia((current) =>
                    event.target.checked ? [...current, option] : current.filter((value) => value !== option),
                  )
                }
              />
              {SENT_VIA_LABELS[option]}
            </label>
          ))}
          <button type="button" className={primary} disabled={saving || via.length === 0} onClick={() => move("sent", via)}>
            Save as sent
          </button>
          <button type="button" className={quiet} disabled={saving} onClick={() => setChoosingVia(false)}>
            Cancel
          </button>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-bip-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-bip-muted">
        Numbers come from each source&apos;s latest finished sync, so they may not line up exactly with {label}. The Sync
        tab shows when each was read.
      </p>
    </div>
  );
}
