"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Grid2x2,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Share2,
  Target,
  X,
} from "lucide-react";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { getClientLifecycleStatus } from "@/lib/clients/client-status";
import {
  CLIENT_LIST_PATH,
  readStoredClientListHref,
} from "@/lib/clients/client-list-view-state";
import { norm } from "@/lib/clients/service-active";
import { clientPlanSummary } from "@/lib/services/client-plan";
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import type { ClientOverviewExtras } from "@/lib/dashboard/load-client-overview-extras";
import type { ClientBackground } from "@/lib/dashboard/load-client-background";

// Literal tokens from the Client Overview handoff — same system as the Clients
// list redesign, written as hex rather than theme variables so the two
// redesigned screens stay pixel-identical while the rest of the app moves over.
const T = {
  bg: "#F5F4EF",
  card: "#FFFFFF",
  ink: "#191813",
  secondary: "#6E6A5E",
  muted: "#8A8678",
  faint: "#A5A091",
  border: "#E6E3DA",
  hairline: "#F5F3EC",
  divider: "#C9C4B5",
  primary: "#2B3FE4",
  dark: "#17160F",
  darkHover: "#292719",
  onDark: "#F5F4EF",
  onDarkMuted: "#A9A69B",
  blue: "#2B3FE4",
  blueTint: "#E8EAFD",
  green: "#1F7A4D",
  greenTint: "#E4F2E9",
  amber: "#B7791F",
  amberTint: "#FFF3DC",
  track: "#EFEDE6",
  // Brand magenta, matching the Services section elsewhere in the app.
  pink: "#CE2084",
  pinkTint: "#FCEBF4",
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

const STATUS_PILL = {
  active: { label: "Active", bg: T.greenTint, fg: T.green },
  onboarding: { label: "Onboarding", bg: T.blueTint, fg: T.blue },
  launch: { label: "Pending launch", bg: T.amberTint, fg: T.amber },
} as const;

const SERVICE_ORDER = [
  { key: "seo", label: "SEO" },
  { key: "ppc", label: "PPC" },
  { key: "smm", label: "SMM" },
  { key: "orm", label: "ORM" },
  { key: "blog", label: "BLOG" },
] as const;

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function agoLabel(iso: string | null | undefined): string | null {
  const days = daysBetween(iso);
  if (days === null) return null;
  if (days <= 0) {
    const hours = Math.floor((Date.now() - new Date(iso!).getTime()) / 3_600_000);
    return hours <= 1 ? "just now" : `${hours}h ago`;
  }
  return days === 1 ? "1d ago" : `${days}d ago`;
}

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ background: color }}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{ color: T.muted, letterSpacing: "0.09em" }}
      className="text-[10.5px] font-bold uppercase"
    >
      {children}
    </p>
  );
}

/** White, inert pulse card. Anything clickable is dark or carries a blue link. */
function Widget({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{ background: T.card, borderColor: T.border, flex: "1 1 215px" }}
      className={`rounded-2xl border px-[18px] py-4 transition-colors duration-150 ${
        clickable ? "cursor-pointer hover:!border-[#C9C4B5]" : ""
      }`}
    >
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}


/**
 * Market and competitor research captured at onboarding. Read-only and dated —
 * nothing here refreshes, and a strategist should be able to tell at a glance
 * that they're reading a snapshot rather than today's picture.
 */

/**
 * Admin-only. Each press is a Claude call with web search, so it names what it
 * will cost you and refuses to run without a city — location is what makes the
 * research local rather than generic, and there is no point spending a call that
 * is guaranteed to come back useless.
 */
function RunResearchButton({
  clientId,
  city,
  hasExisting,
}: {
  clientId: number;
  city: string;
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (hasExisting && !window.confirm(`Replace the existing research for this client?`)) {
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/discovery`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Research failed");
      router.refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Research failed");
    } finally {
      setRunning(false);
    }
  }

  if (!city) {
    return (
      <span style={{ color: T.faint }} className="text-[10.5px]">
        No city on file — can&apos;t research
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span style={{ color: "#B42318" }} className="text-[10.5px]">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        style={{ color: T.primary }}
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold hover:underline disabled:opacity-50"
        title={`Runs an AI market search for ${city}`}
      >
        {running && <Loader2 size={10} className="animate-spin" />}
        {running ? "Researching…" : hasExisting ? "Re-run research" : "Run research"}
      </button>
    </span>
  );
}

function BackgroundPanel({
  background,
  clientId,
  city,
  canRun,
}: {
  background: ClientBackground | null;
  clientId: number;
  city: string;
  canRun: boolean;
}) {
  const competitors = background?.competitors ?? [];
  const competitorAds = background?.competitorAds ?? [];
  const marketSnapshot = background?.marketSnapshot ?? null;
  const searchLandscape = background?.searchLandscape ?? null;

  return (
    <>
      <div className="mt-7 flex flex-wrap items-baseline gap-x-2.5">
        <SectionLabel>Background</SectionLabel>
        {background && (
          <span style={{ color: T.faint }} className="text-[10.5px]">
            from onboarding
            {background.discoveryAt ? ` · ${shortDate(background.discoveryAt)}` : ""}
          </span>
        )}
        {canRun && (
          <span className="ml-auto">
            <RunResearchButton
              clientId={clientId}
              city={city}
              hasExisting={Boolean(background)}
            />
          </span>
        )}
      </div>
      <div
        style={{ background: T.card, borderColor: T.border }}
        className="mt-2.5 rounded-2xl border px-[18px] py-4"
      >
        {!background && (
          <p style={{ color: T.secondary }} className="text-[12.5px]">
            No market research on file for this client yet.
            {!city && " Add a Google Place ID on the Profile tab first — research without a location comes back generic."}
          </p>
        )}
        {marketSnapshot && (
          <BackgroundBlock label="Market">{marketSnapshot}</BackgroundBlock>
        )}
        {searchLandscape && (
          <BackgroundBlock label="Search landscape">{searchLandscape}</BackgroundBlock>
        )}

        {competitors.length > 0 && (
          <BackgroundBlock label="Competitors">
            <ul className="space-y-1.5">
              {competitors.map((competitor) => (
                <li key={competitor.name || competitor.note}>
                  <span style={{ color: T.ink }} className="font-semibold">
                    {competitor.name}
                  </span>
                  {competitor.note && (
                    <span style={{ color: T.secondary }}> — {competitor.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </BackgroundBlock>
        )}

        {competitorAds.length > 0 && (
          <BackgroundBlock
            label="Competitor advertising"
            meta={
              background?.competitorAdsAt
                ? `as of ${shortDate(background.competitorAdsAt)}`
                : null
            }
          >
            <div className="space-y-2.5">
              {competitorAds.map((ad) => (
                <div key={ad.name || ad.offers}>
                  <p style={{ color: T.ink }} className="font-semibold">
                    {ad.name}
                  </p>
                  {ad.offers && <CompetitorLine label="Offers">{ad.offers}</CompetitorLine>}
                  {ad.positioning && (
                    <CompetitorLine label="Positioning">{ad.positioning}</CompetitorLine>
                  )}
                  {ad.counter && (
                    <CompetitorLine label="Our counter">{ad.counter}</CompetitorLine>
                  )}
                </div>
              ))}
            </div>
          </BackgroundBlock>
        )}
      </div>
    </>
  );
}

function BackgroundBlock({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ borderColor: T.hairline }}
      className="border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p
          style={{ color: T.muted, letterSpacing: "0.09em" }}
          className="text-[10px] font-bold uppercase"
        >
          {label}
        </p>
        {meta && (
          <span style={{ color: T.faint }} className="text-[10px]">
            {meta}
          </span>
        )}
      </div>
      <div style={{ color: T.secondary }} className="mt-1.5 text-[12.5px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function CompetitorLine({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="mt-0.5">
      <span style={{ color: T.faint }}>{label}: </span>
      <span style={{ color: T.secondary }}>{children}</span>
    </p>
  );
}

function ModuleTile({
  href,
  icon: Icon,
  tint,
  stroke,
  title,
  sub,
}: {
  href: string;
  icon: React.ElementType;
  tint: string;
  stroke: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      style={{ background: T.dark, flex: "1 1 240px" }}
      className="group flex items-center gap-3.5 rounded-[18px] px-5 py-[22px] transition-colors duration-150 hover:!bg-[#292719]"
    >
      <span
        style={{ background: tint, color: stroke }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      >
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          style={{ color: T.onDark }}
          className="block text-[15.5px] font-semibold"
        >
          {title}
        </span>
        <span
          style={{ color: T.onDarkMuted }}
          className="block truncate text-[12px]"
        >
          {sub}
        </span>
      </span>
      <span
        style={{ borderColor: "rgba(255,255,255,0.22)", color: T.onDark }}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border"
      >
        <ArrowUpRight size={14} strokeWidth={2} />
      </span>
    </Link>
  );
}

// ── Connections & sync drawer ────────────────────────────────────────────────

type SyncJob = {
  label: string;
  endpoint: string;
  requiredField: string | null;
  lastSyncedAt: string | null;
};

function IdRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      style={{ borderColor: T.hairline }}
      className="flex items-center justify-between gap-4 border-b py-[7.5px] last:border-b-0"
    >
      <span style={{ color: T.secondary }} className="shrink-0 text-[12.5px]">
        {label}
      </span>
      <span
        style={{ color: value ? T.ink : T.faint, fontFamily: MONO }}
        className="min-w-0 truncate text-right text-[11.5px]"
        title={value ?? undefined}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function DrawerSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{ color: T.faint, letterSpacing: "0.09em" }}
      className="mb-1 mt-5 text-[10.5px] font-bold uppercase"
    >
      {children}
    </p>
  );
}

function ConnectionsDrawer({
  data,
  jobs,
  onClose,
}: {
  data: ClientWorkspaceInitialData;
  jobs: SyncJob[];
  onClose: () => void;
}) {
  const { client } = data;
  const [statuses, setStatuses] = useState<
    Record<string, "idle" | "running" | "done" | "error">
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function runSync(job: SyncJob) {
    setStatuses((s) => ({ ...s, [job.label]: "running" }));
    setErrors((e) => {
      const next = { ...e };
      delete next[job.label];
      return next;
    });
    try {
      const res = await fetch(job.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setStatuses((s) => ({ ...s, [job.label]: "done" }));
    } catch (e) {
      setStatuses((s) => ({ ...s, [job.label]: "error" }));
      setErrors((prev) => ({
        ...prev,
        [job.label]: e instanceof Error ? e.message : "Sync failed",
      }));
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ background: "rgba(20,18,10,0.32)" }}
        className="fixed inset-0 z-40"
      />
      <aside
        style={{ background: T.card, borderColor: T.border }}
        className="fixed right-0 top-0 z-50 flex h-screen w-[400px] max-w-full flex-col overflow-y-auto border-l px-6 pb-7 pt-[22px]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p style={{ color: T.ink }} className="text-[16px] font-bold">
              Connections &amp; sync
            </p>
            <p style={{ color: T.muted }} className="truncate text-[12px]">
              {client.account_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connections drawer"
            style={{ borderColor: T.border, color: T.secondary }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors hover:!border-[#C9C4B5]"
          >
            <X size={14} />
          </button>
        </div>

        <DrawerSectionLabel>Website</DrawerSectionLabel>
        <IdRow label="Website URL" value={norm(client.website)} />

        <DrawerSectionLabel>Google</DrawerSectionLabel>
        <IdRow label="Search Console" value={norm(client.sc_url)} />
        <IdRow label="GA4 Property ID" value={norm(client.ga4_property_id)} />
        <IdRow label="GA4 ID" value={norm(client.ga4_id)} />
        <IdRow label="Place ID (GBP)" value={norm(client.google_place_id)} />

        <DrawerSectionLabel>Ads</DrawerSectionLabel>
        <IdRow label="Ads Customer ID" value={norm(client.ads_customer_id)} />

        <DrawerSectionLabel>Project management</DrawerSectionLabel>
        <IdRow label="Basecamp Project" value={norm(client.basecamp_project_id)} />
        <IdRow label="Harvest Project" value={norm(client.harvest_project_id)} />
        <IdRow label="Harvest Client" value={norm(client.harvest_client_id)} />

        <DrawerSectionLabel>Data sync</DrawerSectionLabel>
        <div className="flex flex-col">
          {jobs.map((job) => {
            const configured = job.requiredField
              ? Boolean(
                  norm(
                    (client as unknown as Record<string, string | null>)[
                      job.requiredField
                    ],
                  ),
                )
              : true;
            const status = statuses[job.label] ?? "idle";
            const synced =
              status === "done" ? "just now" : (agoLabel(job.lastSyncedAt) ?? "never");
            return (
              <div
                key={job.label}
                style={{ borderColor: T.hairline }}
                className="flex items-center justify-between gap-3 border-b py-[7.5px] last:border-b-0"
              >
                <div className="min-w-0">
                  <p style={{ color: T.ink }} className="text-[12.5px] font-semibold">
                    {job.label}
                  </p>
                  <p style={{ color: T.faint }} className="text-[11px]">
                    {configured ? synced : `Needs ${job.requiredField}`}
                  </p>
                  {errors[job.label] && (
                    <p className="mt-0.5 text-[10.5px] text-red-500">
                      {errors[job.label]}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void runSync(job)}
                  disabled={!configured || status === "running"}
                  style={{
                    color: T.primary,
                    background: "#F5F6FE",
                    borderColor: "#DDE1FB",
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border px-[11px] py-[3px] text-[11.5px] font-bold transition-colors hover:!bg-[#E8EAFD] disabled:opacity-40"
                >
                  {status === "running" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <RefreshCw size={11} />
                  )}
                  Sync
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-2.5">
          <Link
            href={`/dashboard/clients/${client.id}?tab=connections`}
            style={{ borderColor: T.border, color: T.secondary }}
            className="flex-1 rounded-[10px] border py-2 text-center text-[12.5px] font-semibold transition-colors hover:!border-[#C9C4B5] hover:!text-[#191813]"
          >
            Auto-discover
          </Link>
          <Link
            href={`/dashboard/clients/${client.id}?tab=connections`}
            style={{ background: T.ink, color: T.onDark }}
            className="flex-1 rounded-[10px] py-2 text-center text-[12.5px] font-semibold transition-colors hover:!bg-[#33312A]"
          >
            Edit IDs
          </Link>
        </div>
      </aside>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientOverview({
  data,
  extras,
  background,
  isAdminUser = false,
}: {
  data: ClientWorkspaceInitialData;
  extras: ClientOverviewExtras;
  background: ClientBackground | null;
  isAdminUser?: boolean;
}) {
  const router = useRouter();
  const { client } = data;
  const [backHref, setBackHref] = useState(CLIENT_LIST_PATH);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [launchSaving, setLaunchSaving] = useState(false);
  const [awaitingLaunch, setAwaitingLaunch] = useState(client.awaiting_website_launch);

  useEffect(() => setBackHref(readStoredClientListHref()), []);
  useEffect(
    () => setAwaitingLaunch(client.awaiting_website_launch),
    [client.awaiting_website_launch],
  );

  const status = getClientLifecycleStatus({
    ...client,
    awaiting_website_launch: awaitingLaunch,
  });
  const pill = STATUS_PILL[status];

  // Header meta
  const tierLabel = norm(client.tier);
  const strategist = norm(client.marketing_strategist);
  const websiteUrl = norm(client.website);
  const websiteHref = websiteUrl
    ? websiteUrl.startsWith("http")
      ? websiteUrl
      : `https://${websiteUrl}`
    : null;
  const websiteDomain = websiteHref
    ? websiteHref.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;
  const services = SERVICE_ORDER.filter(({ key }) =>
    norm(client[key as "seo" | "ppc" | "smm" | "orm" | "blog"]),
  );

  // Hours
  const pkgHours = client.total_package_hours ?? 0;
  const usedHours = client.hours_for_strategist ?? 0;
  const hoursPercent =
    pkgHours > 0 ? Math.min(100, (usedHours / pkgHours) * 100) : 0;

  // Communication
  const lastTouch = agoLabel(client.last_communication_at);
  const owner = strategist;
  const commsOk = !client.needs_reply;

  // Connections — the six IDs the team actually wires up.
  const connectionFields = [
    client.website,
    client.sc_url,
    client.ga4_property_id,
    client.google_place_id,
    client.ads_customer_id,
    client.basecamp_project_id,
  ];
  const connectionsOk = connectionFields.filter((v) => Boolean(norm(v))).length;
  const connectionsTotal = connectionFields.length;

  // Last report
  const lastReportAt = client.last_report_run_at ?? null;
  const lastReportDays = daysBetween(lastReportAt);
  const reportOverdue = lastReportDays === null || lastReportDays > 35;

  // Sync freshness, read from the snapshots already loaded for this client.
  const jobs: SyncJob[] = [
    {
      label: "Search Console",
      endpoint: "/api/seo/search-console/sync",
      requiredField: "sc_url",
      lastSyncedAt: data.gscSnapshot?.created_at ?? null,
    },
    {
      label: "GA4",
      endpoint: "/api/ga4/sync",
      requiredField: "ga4_property_id",
      lastSyncedAt: data.ga4Snapshot?.created_at ?? null,
    },
    {
      label: "Google Ads",
      endpoint: "/api/ads/sync",
      requiredField: "ads_customer_id",
      lastSyncedAt: data.adsSnapshot?.created_at ?? null,
    },
    {
      label: "Social (Facebook)",
      endpoint: "/api/social/sync",
      requiredField: null,
      lastSyncedAt: data.socialDailySnapshots[0]?.created_at ?? null,
    },
    {
      label: "Google Business Profile",
      endpoint: "/api/gbp/sync",
      requiredField: "google_place_id",
      lastSyncedAt: data.gbpSnapshot?.created_at ?? null,
    },
  ];

  // Module stats
  const socialSub =
    extras.postsThisMonth > 0
      ? `${extras.postsThisMonth} post${extras.postsThisMonth === 1 ? "" : "s"} planned this month`
      : "Build calendar";
  const reportingSub = lastReportAt
    ? `Last report ${shortDate(lastReportAt)} · ${agoLabel(lastReportAt)}`
    : "No report run yet";
  const adsCampaigns = data.adsSnapshot?.campaigns?.length ?? 0;
  const adsSpend = (data.adsSnapshot?.totals?.cost_micros ?? 0) / 1_000_000;
  const adsSub = data.adsSnapshot
    ? `${adsCampaigns} campaign${adsCampaigns === 1 ? "" : "s"} · $${Math.round(adsSpend).toLocaleString()} last window`
    : "Run an audit";
  const adsRunnable = isAdminUser && isSyncableAdsCustomerId(client.ads_customer_id);

  // Reputation reads Google reviews by Place ID, so the tile only makes sense
  // for clients that have one — 215 of 248 today.
  const reputationRunnable = Boolean(norm(client.google_place_id));
  const reputationSub = extras.reputationReportAt
    ? `Analysed ${shortDate(extras.reputationReportAt)} · ${agoLabel(extras.reputationReportAt)}`
    : extras.reviewRating != null
      ? `${extras.reviewRating} ★ · ${extras.reviewVotes ?? 0} reviews · no analysis yet`
      : "Read the reviews";

  // Service + tier per line, e.g. ["SEO Premium", "Blog 2/mo"] — shown inline
  // so the shape of the account reads without a click.
  const planSummary = clientPlanSummary(client);

  async function toggleLaunch() {
    const next = !awaitingLaunch;
    setLaunchSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awaiting_website_launch: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      setAwaitingLaunch(next);
      router.refresh();
    } catch {
      // Leave the toggle where it was; the next render re-reads the server value.
    } finally {
      setLaunchSaving(false);
    }
  }

  return (
    <main
      data-theme="light"
      style={{
        background: T.bg,
        color: T.ink,
        fontFamily: "var(--font-instrument-sans), system-ui, sans-serif",
      }}
      className="min-h-screen flex-1"
    >
      <div className="mx-auto max-w-[1230px] px-[34px] pb-12 pt-[30px]">
        <Link
          href={backHref}
          style={{ color: T.secondary }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors hover:!text-[#191813]"
        >
          <ArrowLeft size={14} strokeWidth={2} /> Back to clients
        </Link>

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                style={{ letterSpacing: "-0.02em" }}
                className="text-[30px] font-semibold leading-tight"
              >
                {client.account_name}
              </h1>
              <span
                style={{ background: pill.bg, color: pill.fg }}
                className="rounded-full px-2.5 py-[3px] text-[11px] font-bold"
              >
                {pill.label}
              </span>
            </div>

            <p
              style={{ color: T.secondary }}
              className="mt-[9px] flex flex-wrap items-center gap-2 text-[12.5px]"
            >
              {tierLabel && <span className="font-semibold">{tierLabel} tier</span>}
              {tierLabel && (strategist || websiteDomain) && (
                <span style={{ color: T.divider }}>·</span>
              )}
              {strategist && (
                <span>
                  Strategist{" "}
                  <span style={{ color: T.ink }} className="font-semibold">
                    {strategist}
                  </span>
                </span>
              )}
              {strategist && websiteDomain && <span style={{ color: T.divider }}>·</span>}
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.primary }}
                  className="font-semibold hover:underline"
                >
                  {websiteDomain} ↗
                </a>
              )}
            </p>

            {services.length > 0 && (
              <div className="mt-[11px] flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <span
                    key={s.key}
                    style={{
                      background: "#FAF9F4",
                      borderColor: "#E9E6DD",
                      color: T.secondary,
                      letterSpacing: "0.06em",
                    }}
                    className="rounded-md border px-[7px] py-[2.5px] text-[10px] font-bold"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled
            title="Widget gallery coming soon"
            style={{ background: T.card, borderColor: T.border, color: T.secondary }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border px-[15px] py-2 text-[12.5px] font-semibold opacity-60"
          >
            <Grid2x2 size={14} strokeWidth={1.9} /> Customize widgets
          </button>
        </div>

        {/* ── Today's pulse ────────────────────────────────────── */}
        <div className="mt-[26px]">
          <SectionLabel>Today&apos;s pulse</SectionLabel>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3">
          <Widget label="Monthly hours">
            {pkgHours > 0 ? (
              <>
                <p className="text-[22px] font-bold leading-none">
                  {usedHours}
                  <span
                    style={{ color: T.faint }}
                    className="text-[13px] font-semibold"
                  >
                    {" "}
                    / {pkgHours} hrs
                  </span>
                </p>
                <div
                  style={{ background: T.track }}
                  className="mt-2.5 h-1.5 w-full overflow-hidden rounded"
                >
                  <div
                    style={{
                      width: `${hoursPercent}%`,
                      background: hoursPercent > 85 ? T.amber : T.primary,
                    }}
                    className="h-full rounded transition-all"
                  />
                </div>
                <p
                  style={{ color: T.faint }}
                  className="mt-1.5 text-[11.5px] font-semibold"
                >
                  {Math.round(hoursPercent)}% used
                </p>
              </>
            ) : (
              <p style={{ color: T.faint }} className="text-[15px] font-bold">
                No package hours set
              </p>
            )}
          </Widget>

          <Widget label="Communication">
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <Dot color={commsOk ? T.green : T.amber} />
              {commsOk ? "All caught up" : "Needs reply"}
            </p>
            <p style={{ color: T.faint }} className="mt-1.5 text-[11.5px] font-semibold">
              {lastTouch
                ? `${client.needs_reply ? "Client wrote" : "Last touch"} ${lastTouch}${owner ? ` · ${owner}` : ""}`
                : "No synced messages"}
            </p>
          </Widget>

          <Widget label="Connections" onClick={() => setDrawerOpen(true)}>
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <Dot color={connectionsOk === connectionsTotal ? T.green : T.amber} />
              {connectionsOk} of {connectionsTotal} connected
            </p>
            <p
              style={{ color: T.primary }}
              className="mt-1.5 text-[11.5px] font-semibold"
            >
              View IDs &amp; sync →
            </p>
          </Widget>

          <Widget label="Last report">
            <p className="flex items-center gap-2 text-[22px] font-bold leading-none">
              {lastReportAt ? (
                shortDate(lastReportAt)
              ) : (
                <>
                  <Dot color={T.faint} />
                  <span className="text-[15px]">None yet</span>
                </>
              )}
            </p>
            <p
              style={{ color: reportOverdue ? T.amber : T.faint }}
              className="mt-1.5 text-[11.5px] font-semibold"
            >
              {lastReportAt
                ? `${agoLabel(lastReportAt)}${reportOverdue ? " · monthly report due" : ""}`
                : "Monthly cadence · none recorded"}
            </p>
          </Widget>

          {status !== "active" && (
            <Widget label="Website launch">
              <p className="flex items-center gap-2 text-[15px] font-bold">
                <Dot color={awaitingLaunch ? T.amber : T.green} />
                {awaitingLaunch ? "Not launched" : "Launched"}
              </p>
              <button
                type="button"
                onClick={() => void toggleLaunch()}
                disabled={launchSaving}
                style={{ color: T.primary }}
                className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold hover:underline disabled:opacity-50"
              >
                {launchSaving && <Loader2 size={10} className="animate-spin" />}
                {awaitingLaunch ? "Mark as launched" : "Mark as not launched"}
              </button>
            </Widget>
          )}

          <div
            style={{ borderColor: "#D9D5C9", flex: "0 1 215px" }}
            className="rounded-2xl border-[1.5px] border-dashed px-[18px] py-4"
          >
            <p style={{ color: T.faint }} className="text-[13px] font-semibold">
              + Add widget
            </p>
            <p style={{ color: T.faint }} className="mt-1 text-[11px]">
              Ads spend · Review alerts · Tasks
            </p>
          </div>
        </div>

        {/* ── Plan ─────────────────────────────────────────────── */}
        {/* Reference, not a tool — so it reads as information rather than
            another module button. The scope itself will land here in place of
            the links once there's a compact way to show it. */}
        <div className="mt-7">
          <SectionLabel>Plan</SectionLabel>
        </div>
        <div
          style={{ borderColor: T.pink, background: T.pinkTint }}
          className="mt-2.5 rounded-2xl border-[1.5px] px-[18px] py-4"
        >
          {planSummary.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {planSummary.map((item) => (
                <span
                  key={item}
                  style={{ color: T.pink, borderColor: T.pink }}
                  className="rounded-full border bg-white/70 px-2.5 py-1 text-[11.5px] font-semibold"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: T.pink }} className="text-[12.5px] font-semibold">
              No services recorded
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Link
              href={`/services?clientId=${client.id}`}
              style={{ color: T.pink }}
              className="text-[11.5px] font-semibold hover:underline"
            >
              What this tier includes
            </Link>
            <Link
              href={`/client-expectations-print/${client.id}`}
              style={{ color: T.pink }}
              className="text-[11.5px] font-semibold hover:underline"
            >
              Client expectations
            </Link>
          </div>
        </div>

        {(background || isAdminUser) && (
          <BackgroundPanel
            background={background}
            clientId={client.id}
            city={norm(client.city) ?? ""}
            canRun={isAdminUser}
          />
        )}

        {/* ── Modules ──────────────────────────────────────────── */}
        <div className="mt-7">
          <SectionLabel>Modules</SectionLabel>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3">
          <ModuleTile
            href={`/social-planner?client=${client.id}`}
            icon={Share2}
            tint={T.blueTint}
            stroke={T.blue}
            title="Social Media"
            sub={socialSub}
          />
          <ModuleTile
            href={`/reports/${client.id}`}
            icon={BarChart3}
            tint={T.greenTint}
            stroke={T.green}
            title="Reporting"
            sub={reportingSub}
          />
          {adsRunnable && (
            <ModuleTile
              href={`/ads-diagnostic?customer=${encodeURIComponent(norm(client.ads_customer_id) ?? "")}`}
              icon={Target}
              tint={T.amberTint}
              stroke={T.amber}
              title="Google Ads audit"
              sub={adsSub}
            />
          )}
          {reputationRunnable && (
            <ModuleTile
              href={`/reputation?clientId=${client.id}`}
              icon={MessageSquareQuote}
              tint={T.greenTint}
              stroke={T.green}
              title="Reputation"
              sub={reputationSub}
            />
          )}
        </div>
      </div>

      {drawerOpen && (
        <ConnectionsDrawer
          data={data}
          jobs={jobs}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </main>
  );
}
