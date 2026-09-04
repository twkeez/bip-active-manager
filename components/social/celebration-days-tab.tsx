"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, ExternalLink } from "lucide-react";
import type { SocialAwarenessDay } from "@/lib/social/types";
import { reviewAwarenessDays } from "@/lib/social/awareness-review";
import { renderClientRequest } from "@/lib/social/client-request-message";
import { resolveAwarenessDate } from "@/lib/social/awareness-resolver";

/**
 * The celebration calendar as the team works it: what we still owe clients an
 * ask for, and which dates have not been confirmed against their source.
 *
 * Deliberately not in Coal Mines. This is social-media work, so it lives where
 * the social-media work happens.
 */

type Props = { days: SocialAwarenessDay[] };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy message"}
    </button>
  );
}

export function CelebrationDaysTab({ days }: Props) {
  const now = useMemo(() => new Date(), []);
  const year = now.getUTCFullYear();
  const review = useMemo(() => reviewAwarenessDays(days, now), [days, now]);

  // Days that need something from the client, ordered by how soon we need it.
  const asks = useMemo(() => {
    return days
      .filter((d) => d.client_request_template)
      .map((day) => {
        const rendered = renderClientRequest(day, year, now);
        const resolved = resolveAwarenessDate(day, year);
        return { day, rendered, start: resolved?.start ?? null };
      })
      .filter((a) => a.rendered !== null)
      .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  }, [days, year, now]);

  return (
    <div className="space-y-4">
      {/* ── What we owe clients an ask for ───────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-bip-text">Client asks</h2>
        <p className="mt-0.5 text-xs text-bip-muted">
          Celebration days that need something from the client before we can post. Dates come
          from the stored rule, so the message never needs rewriting year to year.
        </p>
      </div>

      {asks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bip-border p-6 text-center text-xs text-bip-muted">
          No celebration days have a client request message yet.
        </p>
      ) : (
        asks.map(({ day, rendered }) => (
          <div key={day.id} className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-bip-text">{day.name}</p>
                <p className="mt-0.5 text-xs text-bip-muted">
                  {rendered!.dateRange} {year}
                  {rendered!.respondBy && (
                    <>
                      {" · "}
                      <span className={rendered!.overdue ? "text-red-300" : "text-bip-text"}>
                        replies by {rendered!.respondBy}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <CopyButton text={rendered!.message} />
            </div>

            {rendered!.overdue && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                The reply deadline has passed for {year}.
              </p>
            )}

            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border-t border-bip-border pt-3 font-sans text-xs leading-relaxed text-bip-muted">
              {rendered!.message}
            </pre>
          </div>
        ))
      )}

      {/* ── Date verification backlog ────────────────────────────────────── */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold text-bip-text">Date review</h2>
        <p className="mt-0.5 text-xs text-bip-muted">
          The planner only uses dates that are verified and active. Everything else is invisible
          to it. Dates get confirmed against their source each December or January, when the
          governing bodies publish the year ahead.
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          review.inReviewWindow
            ? "border-red-500/40"
            : review.unverified.length > 0
              ? "border-amber-500/40"
              : "border-bip-border"
        } bg-bip-card`}
      >
        <p
          className={`text-xs ${
            review.inReviewWindow
              ? "text-red-300"
              : review.unverified.length > 0
                ? "text-amber-300"
                : "text-emerald-400"
          }`}
        >
          {review.headline}
        </p>

        {review.missingSource.length > 0 && (
          <p className="mt-1.5 text-[11px] text-bip-muted">
            {review.missingSource.length} verified with no source link to re-check against.
          </p>
        )}

        {review.unverified.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-bip-border pt-3">
            {review.unverified.map((day) => (
              <li key={day.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="truncate text-bip-muted">{day.name}</span>
                {day.source_url ? (
                  <a
                    href={day.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-bip-text hover:underline"
                  >
                    source <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="shrink-0 text-bip-muted/70">no source</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
