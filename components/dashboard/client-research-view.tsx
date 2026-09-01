"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Gauge,
  Globe,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  Swords,
  TrendingUp,
} from "lucide-react";
import type {
  BrandElements,
  CompetitorOffer,
  Discovery,
} from "@/components/dashboard/onboarding/types";
import type { ClientRow } from "@/lib/types/client";
import ClientSiteContentCard from "@/components/dashboard/client-site-content-card";

/**
 * Research & audits for ANY client — not just ones mid-onboarding.
 *
 * Every tool here was originally reachable only as an onboarding checklist step,
 * but none of the endpoints ever needed onboarding: they take a client id and
 * upsert. What tied them to new clients was the UI, so this tab talks to the
 * same endpoints directly rather than faking a checklist item to host them.
 *
 * Deliberately not reusing the step `Action` components: those are built around
 * "a step you tick off" — they call `toggleManual`, read `item.done`, and write
 * to `client_onboarding_items`, which does not exist for a client who never
 * onboarded. The endpoints are the shared surface, not the components.
 */

type Props = {
  client: ClientRow;
};

type ResearchPayload = {
  discovery?: Discovery | null;
  discoveryAt?: string | null;
  competitorOffers?: CompetitorOffer[] | null;
  competitorAdsAt?: string | null;
  brandElements?: BrandElements | null;
  brandElementsAt?: string | null;
  error?: string;
};

function whenRun(value: string | null | undefined): string {
  if (!value) return "Never run";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never run";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Run today";
  if (days === 1) return "Run yesterday";
  if (days < 60) return `Run ${days} days ago`;
  return `Run ${d.toLocaleDateString()}`;
}

/** Stale research read as current is worse than none, so say so past 90 days. */
function isStale(value: string | null | undefined): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() > 90 * 86_400_000;
}

function ToolCard({
  icon: Icon,
  name,
  blurb,
  ranAt,
  summary,
  blocked,
  running,
  message,
  actionLabel,
  onRun,
}: {
  icon: React.ElementType;
  name: string;
  blurb: string;
  ranAt?: string | null;
  summary: React.ReactNode;
  /** Why this can't run right now — renders instead of the button. */
  blocked?: string | null;
  running: boolean;
  message?: string | null;
  actionLabel: string;
  onRun?: () => void;
}) {
  const stale = isStale(ranAt);
  return (
    <div className="rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bip-accent" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bip-text">{name}</p>
            <p className="mt-0.5 text-xs text-bip-muted">{blurb}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-[11px] ${stale ? "text-amber-400" : "text-bip-muted"}`}>
            {whenRun(ranAt)}
            {stale ? " · stale" : ""}
          </span>
          {blocked || !onRun ? (
            <span className="text-[11px] text-bip-muted">{blocked}</span>
          ) : (
            <button
              type="button"
              disabled={running}
              onClick={onRun}
              className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {running ? "Running…" : actionLabel}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-bip-border pt-3 text-xs text-bip-muted">{summary}</div>
      {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-bip-muted">{children}</p>;
}

export default function ClientResearchView({ client }: Props) {
  const clientId = client.id;
  const [data, setData] = useState<ResearchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
      const payload = (await res.json()) as ResearchPayload;
      if (!res.ok) throw new Error(payload.error ?? "Failed to load research");
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load research");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const say = (key: string, msg: string | null) =>
    setMessages((prev) => ({ ...prev, [key]: msg }));

  /**
   * Every tool is a POST that upserts and then needs the panel re-read. Re-runs
   * confirm first — these overwrite the stored result, and several cost a Claude
   * call. The server is the real authority on who may run what (market research
   * is admin-only), so a 403 surfaces as the card's message rather than being
   * predicted here.
   */
  async function run(
    key: string,
    url: string,
    opts: { body?: unknown; hasExisting: boolean; confirmWord: string; done: string },
  ) {
    if (opts.hasExisting && !window.confirm(`Replace the existing ${opts.confirmWord} for ${client.account_name}?`)) {
      return;
    }
    setRunning(key);
    say(key, null);
    try {
      const res = await fetch(url, {
        method: "POST",
        ...(opts.body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body) }
          : {}),
      });
      const payload = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(payload.error ?? "Failed");
      say(key, payload.count != null ? `${opts.done} — ${payload.count} recorded.` : opts.done);
      await load();
    } catch (e) {
      say(key, e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading research…
      </div>
    );
  }

  const discovery = data?.discovery ?? null;
  const competitors = data?.competitorOffers ?? null;
  const brand = data?.brandElements ?? null;

  const city = (client.city ?? "").trim();
  const website = (client.website ?? "").trim();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="text-sm font-semibold text-bip-text">Research &amp; audits</p>
        <p className="mt-1 text-xs text-bip-muted">
          Run these for any client, at any time — they aren&apos;t tied to onboarding. Each result is
          stored against the client and dated, so you can tell fresh work from a snapshot.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <ToolCard
        icon={Globe}
        name="Market research"
        blurb="Competitors, market snapshot and search landscape for this practice's area."
        ranAt={data?.discoveryAt}
        running={running === "discovery"}
        message={messages.discovery}
        actionLabel={discovery ? "Re-run" : "Run"}
        blocked={city ? null : "No city on file — can't research"}
        onRun={() =>
          void run("discovery", `/api/clients/${clientId}/onboarding/discovery`, {
            hasExisting: !!discovery,
            confirmWord: "market research",
            done: "Research captured.",
          })
        }
        summary={
          discovery ? (
            <div className="space-y-1.5">
              {discovery.marketSnapshot && <p>{discovery.marketSnapshot}</p>}
              {discovery.competitors?.length > 0 && (
                <p className="text-bip-text">
                  {discovery.competitors.length} competitor
                  {discovery.competitors.length === 1 ? "" : "s"}:{" "}
                  <span className="text-bip-muted">
                    {discovery.competitors.map((c) => c.name).filter(Boolean).join(", ")}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <Empty>
              Not run yet. Uses an AI web search localised to {city || "the practice's city"}.
            </Empty>
          )
        }
      />

      <ToolCard
        icon={Swords}
        name="Competitor research"
        blurb="What competitors advertise, how they position, and how we counter it."
        ranAt={data?.competitorAdsAt}
        running={running === "competitors"}
        message={messages.competitors}
        actionLabel={competitors?.length ? "Re-run" : "Run"}
        onRun={() =>
          void run("competitors", `/api/clients/${clientId}/onboarding/competitor-ads`, {
            hasExisting: !!competitors?.length,
            confirmWord: "competitor research",
            done: "Competitor research captured.",
          })
        }
        summary={
          competitors?.length ? (
            <ul className="space-y-1">
              {competitors.slice(0, 4).map((c) => (
                <li key={c.name || c.offers}>
                  <span className="text-bip-text">{c.name}</span>
                  {c.offers && <span> — {c.offers}</span>}
                </li>
              ))}
              {competitors.length > 4 && <li>+{competitors.length - 4} more</li>}
            </ul>
          ) : (
            <Empty>Not run yet.</Empty>
          )
        }
      />

      <ToolCard
        icon={Search}
        name="Keywords"
        blurb="The keywords we track for this client, sized to their SEO tier."
        running={false}
        actionLabel="Open"
        blocked="Open the SEO tab to pick keywords"
        summary={
          <Empty>
            Shared across the team — everyone working this client sees and edits the same list.
            Picked on the SEO tab, where the volume figures live; baseline rankings then measure
            whatever is tracked here.
          </Empty>
        }
      />

      <ToolCard
        icon={Palette}
        name="Brand elements"
        blurb="Logo, hero image, theme colour and title pulled from the client's site."
        ranAt={data?.brandElementsAt}
        running={running === "brand"}
        message={messages.brand}
        actionLabel={brand ? "Re-run" : "Run"}
        blocked={website ? null : "No website on file"}
        onRun={() =>
          void run("brand", `/api/clients/${clientId}/onboarding/brand-elements`, {
            hasExisting: !!brand,
            confirmWord: "brand elements",
            done: "Brand elements captured.",
          })
        }
        summary={
          brand ? (
            <div className="flex flex-wrap items-center gap-3">
              {brand.title && <span className="text-bip-text">{brand.title}</span>}
              {brand.themeColor && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full border border-bip-border"
                    style={{ background: brand.themeColor }}
                  />
                  {brand.themeColor}
                </span>
              )}
              {brand.logoUrl && <span>Logo captured</span>}
              {brand.heroImage && <span>Hero captured</span>}
            </div>
          ) : (
            <Empty>Not run yet.</Empty>
          )
        }
      />

      <ToolCard
        icon={Gauge}
        name="Site audit"
        blurb="Lighthouse performance, accessibility and SEO scores for the client's site."
        running={running === "siteAudit"}
        message={messages.siteAudit}
        actionLabel="Run"
        blocked={website ? null : "No website on file"}
        onRun={() =>
          void run("siteAudit", "/api/seo/lighthouse", {
            body: { clientId },
            hasExisting: false,
            confirmWord: "site audit",
            done: "Site audit captured.",
          })
        }
        summary={<Empty>Captures a fresh snapshot each run. Results live on the SEO tab.</Empty>}
      />

      <ClientSiteContentCard clientId={clientId} website={website || null} />

      <ToolCard
        icon={TrendingUp}
        name="Baseline rankings"
        blurb="Where this client currently ranks organically for their tracked keywords."
        running={running === "baseline"}
        message={messages.baseline}
        actionLabel="Run"
        blocked={website ? null : "No website on file"}
        onRun={() =>
          void run("baseline", "/api/organic-rank/scan", {
            body: { clientId },
            hasExisting: false,
            confirmWord: "baseline scan",
            done: "Baseline captured",
          })
        }
        summary={
          <Empty>
            Scans the keywords tracked for this client. Run market research and pick keywords first,
            or the baseline has nothing to measure.
          </Empty>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-bip-border bg-bip-card p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bip-muted" />
        <p className="text-[11px] text-bip-muted">
          Market research spends an AI web-search call each time it runs, so it&apos;s limited to
          admins — the button will tell you if you can&apos;t run it. The rest are free to re-run.
        </p>
      </div>
    </div>
  );
}
