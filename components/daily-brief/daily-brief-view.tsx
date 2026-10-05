import Link from "next/link";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { BIP_STATUS_LABEL } from "@/lib/poobah/types";
import {
  TIER_BLURB,
  TIER_LABEL,
  type BriefClient,
  type BriefTier,
  type DailyBrief,
} from "@/lib/daily-brief/types";

/**
 * The brief itself: counts, notes about what was left out or could not be read,
 * then the clients in tiers, most pressing first. Everything shown comes from the
 * saved brief; nothing here recomputes or judges.
 */

const TIERS: BriefTier[] = [1, 2, 3, 4, 5];

const LEVEL_DOT: Record<"needs_you" | "watch", string> = {
  needs_you: "bg-red-400",
  watch: "bg-amber-400",
};

const eastern = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Notice({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-bip-border bg-bip-card text-bip-muted"
      }`}
    >
      {children}
    </p>
  );
}

function ClientCard({ client }: { client: BriefClient }) {
  const lifecycle = client.lifecycle === "active" ? null : BIP_STATUS_LABEL[client.lifecycle];
  return (
    <li className="rounded-xl border border-bip-border bg-bip-card">
      <details className="group" open={client.tier <= 3}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <span className="font-medium text-bip-text">{client.name}</span>
          {lifecycle && (
            <span className="rounded-full border border-bip-border px-2 py-0.5 text-[11px] text-bip-muted">{lifecycle}</span>
          )}
          <span className="min-w-0 truncate text-xs text-bip-muted">
            {[client.services.join(", "), client.strategists.join(", ")].filter(Boolean).join(" · ")}
          </span>
        </summary>

        <div className="space-y-3 border-t border-bip-border px-4 py-3 text-sm">
          {client.reasons.length > 0 && <p className="text-bip-muted">{client.reasons.join(" · ")}</p>}

          {client.escalatedThreads.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-bip-muted">Chasing us in Basecamp</p>
              <ul className="mt-1 space-y-1">
                {client.escalatedThreads.map((thread, index) => (
                  <li key={`${thread.title}-${index}`}>
                    {thread.url ? (
                      <a href={thread.url} target="_blank" rel="noreferrer" className="text-bip-text underline">
                        {thread.title}
                      </a>
                    ) : (
                      <span className="text-bip-text">{thread.title}</span>
                    )}
                    <span className="text-bip-muted">
                      {" "}
                      · waiting {plural(thread.days, "day")}
                      {thread.reason ? ` · ${thread.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {client.findings.length > 0 && (
            <ul className="space-y-1.5">
              {client.findings.map((finding) => (
                <li key={finding.id} className="flex gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[finding.level as "needs_you" | "watch"] ?? "bg-bip-muted"}`}
                    aria-label={finding.level === "needs_you" ? "Needs action" : "Watch"}
                  />
                  <span className="min-w-0">
                    <span className="text-bip-text">{finding.headline}</span>
                    <span className="text-bip-muted">
                      {[finding.scope.toUpperCase(), finding.metric, finding.detail].filter(Boolean).map((part) => ` · ${part}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {client.blindSpots.length > 0 && (
            <p className="text-bip-muted">
              We cannot see {client.blindSpots.map((spot) => spot.source).join(", ")}:{" "}
              {client.blindSpots.map((spot) => spot.reason).join("; ")}.
            </p>
          )}

          {client.awaitingReplyCount > 0 && (
            <p className="text-bip-muted">
              {plural(client.awaitingReplyCount, "Basecamp thread")} waiting 3+ days for our reply.
            </p>
          )}

          {client.watch && (
            <p className="rounded-lg bg-bip-fill px-3 py-2 text-bip-muted">
              <Link href={`/client-watch/${client.watch.watchId}`} className="font-medium text-bip-text hover:underline">
                Poobah Client Watch
              </Link>
              {client.watch.status ? `: ${client.watch.status}` : ": no status set"}
              {` · ${plural(client.watch.openItems, "open item")}`}
              {client.watch.statusSetAt ? ` · status set ${eastern(client.watch.statusSetAt)}` : ""}
            </p>
          )}

          <Link href={`/dashboard/clients/${client.clientId}`} className="inline-block text-xs text-bip-accent hover:underline">
            Open client
          </Link>
        </div>
      </details>
    </li>
  );
}

export default function DailyBriefView({ brief }: { brief: DailyBrief }) {
  const needAttention = brief.counts[2] + brief.counts[3];
  const left = brief.excluded;

  return (
    <div className="space-y-6">
      <StatTiles>
        <StatTile label="Active clients" value={brief.clients.length} />
        <StatTile label="Onboarding" value={brief.counts[1]} />
        <StatTile label="Chasing us or need action" value={needAttention} tone={needAttention > 0 ? "warn" : undefined} />
        <StatTile label="Quiet" value={brief.counts[5]} tone="good" />
      </StatTiles>

      {brief.staleSources.length > 0 && (
        <Notice tone="warn">
          These nightly syncs had not finished when this brief was built, so some numbers may be a day old:{" "}
          {brief.staleSources.join(", ")}.
        </Notice>
      )}
      {brief.freshnessError && (
        <Notice tone="warn">Could not confirm today&apos;s data had synced: {brief.freshnessError}</Notice>
      )}
      {brief.watchError && (
        <Notice tone="warn">Poobah Client Watch notes could not be read, so they are missing below: {brief.watchError}</Notice>
      )}
      {brief.unchecked.length > 0 && (
        <Notice tone="warn">
          {plural(brief.unchecked.length, "client")} could not be checked and {brief.unchecked.length === 1 ? "is" : "are"} not in the
          list below:{" "}
          {brief.unchecked.map((client) => `${client.name} (${client.reason})`).join("; ")}
        </Notice>
      )}

      {TIERS.map((tier) => {
        const clients = brief.clients.filter((client) => client.tier === tier);
        if (clients.length === 0) return null;
        return (
          <section key={tier} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold text-bip-text">
                {TIER_LABEL[tier]} <span className="font-normal text-bip-muted">· {clients.length}</span>
              </h2>
              <p className="text-xs text-bip-muted">{TIER_BLURB[tier]}</p>
            </div>
            <ul className="space-y-2">
              {clients.map((client) => (
                <ClientCard key={client.clientId} client={client} />
              ))}
            </ul>
          </section>
        );
      })}

      <Notice tone="info">
        Left out: {plural(left.websiteOnly, "website-only account")}, {plural(left.paused, "paused (low-contact) account")} and{" "}
        {plural(left.noServices, "account")} past onboarding with no marketing service. Built {eastern(brief.generatedAt)} Eastern from
        data the app already stores; findings are computed by code, not written by a model.
      </Notice>
    </div>
  );
}
