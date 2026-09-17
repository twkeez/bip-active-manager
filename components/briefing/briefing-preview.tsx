"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Sparkles, ThumbsUp } from "lucide-react";
import {
  composeClientMessage,
  composeClientSubject,
  composeStrategistNote,
  composeStrategistSubject,
} from "@/lib/briefing/compose";
import type { ClientBriefing, FindingLevel } from "@/lib/briefing/types";

/**
 * The briefing for one client, before any of it is sent anywhere.
 *
 * This screen exists to answer one question before the schedule and the emails
 * are built: is what this says actually worth a strategist's attention? So it
 * shows the findings, what we could not see, and the note itself exactly as it
 * would arrive.
 */

const LEVEL_STYLE: Record<FindingLevel, { chip: string; label: string; icon: typeof AlertTriangle }> = {
  needs_you: { chip: "border-amber-500/40 bg-amber-500/10 text-amber-600", label: "Needs you", icon: AlertTriangle },
  watch: { chip: "border-bip-border bg-bip-fill text-bip-muted", label: "Keep an eye", icon: Eye },
  good: { chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600", label: "Good news", icon: ThumbsUp },
};

export default function BriefingPreview({
  clients,
}: {
  clients: Array<{ id: number; account_name: string }>;
}) {
  const [clientId, setClientId] = useState<number | null>(clients[0]?.id ?? null);
  const [briefing, setBriefing] = useState<ClientBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId === null) return;
    let live = true;
    void (async () => {
      // Set inside the async body, not the effect's: the lint rule against
      // synchronous setState in an effect is about cascading renders, and a
      // fetch-on-mount is the exception the app already makes elsewhere.
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/briefings/${clientId}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; briefing?: ClientBriefing };
        if (!live) return;
        if (!response.ok || !payload.briefing) throw new Error(payload.error ?? "Could not build the briefing");
        setBriefing(payload.briefing);
      } catch (loadError) {
        if (live) {
          setBriefing(null);
          setError(loadError instanceof Error ? loadError.message : "Could not build the briefing");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [clientId]);

  const clientMessage = briefing ? composeClientMessage(briefing) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <h1 className="text-lg font-semibold text-bip-text">Client briefings</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-bip-muted">
          Two messages built from one client&rsquo;s numbers, twice a month: good news for the practice, and everything
          else for their strategist alone. Nothing is stored or sent yet — this is here to judge whether they are
          worth reading. Only clients buying a marketing service appear;
          website-only clients are not briefed. Nothing in the app tracks published blog posts yet, so no briefing
          can speak to the blog.
        </p>
        <select
          value={clientId ?? ""}
          onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : null)}
          className="mt-3 min-w-64 rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none"
        >
          {clients.length === 0 && <option value="">No clients with an active service</option>}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.account_name}
            </option>
          ))}
        </select>
        <span className="ml-2 text-[11px] text-bip-muted">{clients.length} clients would be briefed</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-bip-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading this client&rsquo;s data…
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {briefing && !loading && (
        <>
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-bip-text">{briefing.clientName}</p>
              <p className="text-[11px] text-bip-muted">
                {briefing.strategists.length > 0
                  ? `To ${briefing.strategists.map((person) => person.email ?? person.name).join(", ")}`
                  : "No strategist assigned — this would come to you"}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {briefing.services.map((service) => (
                <span
                  key={service.key}
                  className="rounded-full border border-bip-border px-2 py-0.5 text-[11px] text-bip-muted"
                >
                  {service.label}
                  {service.planLabel ? ` · ${service.planLabel}` : ""}
                </span>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
              What the strategist is told
            </p>
            <div className="mt-2 space-y-2">
              {briefing.findings.length === 0 ? (
                <p className="text-sm text-bip-muted">
                  Nothing met the bar for a finding. That is a normal fortnight, not an empty result.
                </p>
              ) : (
                briefing.findings.map((finding) => {
                  const style = LEVEL_STYLE[finding.level];
                  const Icon = style.icon;
                  return (
                    <div key={finding.id} className="rounded-lg border border-bip-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${style.chip}`}>
                          <Icon className="h-3 w-3" /> {style.label}
                        </span>
                        <span className="text-[10.5px] uppercase tracking-wide text-bip-muted">{finding.scope}</span>
                        {finding.metric && <span className="text-[11px] text-bip-muted">{finding.metric}</span>}
                      </div>
                      <p className="mt-1.5 text-sm text-bip-text">{finding.headline}</p>
                      {finding.detail && <p className="mt-0.5 text-xs text-bip-muted">{finding.detail}</p>}
                    </div>
                  );
                })
              )}
            </div>

            {briefing.highlights.length > 0 && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                  Good news for the client
                </p>
                <ul className="mt-1.5 space-y-1">
                  {briefing.highlights.map((highlight) => (
                    <li key={highlight.id} className="text-xs text-bip-text">
                      • {highlight.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {briefing.blindSpots.length > 0 && (
              <div className="mt-4 rounded-lg border border-bip-border bg-bip-fill/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-bip-text">
                  <EyeOff className="h-3.5 w-3.5" /> What we could not see
                </p>
                <ul className="mt-1.5 space-y-1">
                  {briefing.blindSpots.map((spot) => (
                    <li key={`${spot.scope}-${spot.source}`} className="text-xs text-bip-muted">
                      <span className="text-bip-text">{spot.source}</span>: {spot.reason}
                      {spot.lastSeen ? ` — last data ${spot.lastSeen.slice(0, 10)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* The client's half: good news only. */}
          <div className="rounded-xl border border-emerald-500/30 bg-bip-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
              <Sparkles className="h-3.5 w-3.5" /> To the practice
            </p>
            {clientMessage ? (
              <>
                <p className="mt-2 text-sm font-medium text-bip-text">{composeClientSubject(briefing)}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-bip-text">
                  {clientMessage}
                </pre>
              </>
            ) : (
              <p className="mt-2 text-sm text-bip-muted">
                Nothing to send this time. Fewer than two things went up, and a note scraping for one thin positive
                reads worse than no note at all.
              </p>
            )}
          </div>

          {/* The strategist's half: everything the practice does not get from us. */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bip-muted">
              <EyeOff className="h-3.5 w-3.5" /> To the strategist, not the client
            </p>
            <p className="mt-2 text-sm font-medium text-bip-text">{composeStrategistSubject(briefing)}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-bip-text">
              {composeStrategistNote(briefing)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
