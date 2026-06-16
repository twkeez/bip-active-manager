"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  Search,
  Share2,
  XCircle,
} from "lucide-react";
import { previewText, openableBasecampUrl } from "@/lib/basecamp/display";
import { evaluateClientSetup } from "@/lib/clients/setup-status";
import {
  acknowledgeNoReply,
  shouldShowReplyAlert,
} from "@/lib/clients/acknowledge-no-reply";
import {
  CLIENT_LIST_PATH,
  readStoredClientListHref,
} from "@/lib/clients/client-list-view-state";
import {
  activeServiceLabels,
  getClientActiveServices,
  norm,
} from "@/lib/clients/service-active";
import type {
  ClientDetailTab,
  ClientWorkspaceInitialData,
} from "@/lib/dashboard/client-workspace-types";
import type { BasecampThreadEvent } from "@/lib/types/client";
import NotifyStrategistButton from "@/components/dashboard/notify-strategist-button";
import SmartAdsPlaybook from "@/components/dashboard/smart-ads-playbook";
import type { ClientSetupItem } from "@/lib/clients/types";
import type { StrategistContact } from "@/lib/team/strategist-roster";
const DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "reporting", label: "Reporting" },
  { id: "seo_ops", label: "SEO Ops" },
  { id: "onboarding", label: "Onboarding" },
  { id: "comms", label: "Comms" },
  { id: "seo", label: "SEO" },
  { id: "ads", label: "Ads" },
  { id: "social", label: "Social" },
  { id: "sitemaps", label: "Sitemaps" },
  { id: "actions", label: "Actions" },
];
function formatRelativeDays(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
function formatCompactNumber(value: number) {
  if (value >= 1000)
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 2).replace(/\.?0+$/, "")}K`;
  return value.toLocaleString("en-US");
}
function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}
type IntegrationRow = {
  id: string;
  label: string;
  connected: boolean;
  severity: "ok" | "recommended" | "required";
  detail: string;
  gap?: ClientSetupItem;
};
function buildIntegrationRows(
  data: ClientWorkspaceInitialData,
  setupGaps: ClientSetupItem[],
): IntegrationRow[] {
  const { client, socialConnections } = data;
  const gapByField = new Map<string, ClientSetupItem>();
  for (const gap of setupGaps) {
    gapByField.set(gap.id, gap);
    if (gap.field) gapByField.set(gap.field, gap);
  }
  const rows: IntegrationRow[] = [
    {
      id: "ga4",
      label: "GA4",
      connected: Boolean(norm(client.ga4_property_id)),
      severity: gapByField.has("ga4_property_id") ? "recommended" : "ok",
      detail: norm(client.ga4_property_id) || "Not set",
      gap: gapByField.get("ga4_property_id"),
    },
    {
      id: "sc",
      label: "Search Console",
      connected: Boolean(norm(client.sc_url)),
      severity: gapByField.has("sc_url") ? "required" : "ok",
      detail: norm(client.sc_url) || "Not set",
      gap: gapByField.get("sc_url"),
    },
    {
      id: "ads",
      label: "Google Ads",
      connected: Boolean(norm(client.ads_customer_id)),
      severity: gapByField.has("ads_customer_id") ? "required" : "ok",
      detail: norm(client.ads_customer_id) || "Not set",
      gap: gapByField.get("ads_customer_id"),
    },
    {
      id: "gbp",
      label: "Google Place ID",
      connected: Boolean(norm(client.google_place_id)),
      severity: gapByField.has("google_place_id") ? "recommended" : "ok",
      detail: norm(client.google_place_id) || "Not set",
      gap: gapByField.get("google_place_id"),
    },
    {
      id: "basecamp",
      label: "Basecamp",
      connected: Boolean(norm(client.basecamp_project_id)),
      severity: gapByField.has("basecamp_project_id") ? "required" : "ok",
      detail: norm(client.basecamp_project_id) || "Not set",
      gap: gapByField.get("basecamp_project_id"),
    },
    {
      id: "social",
      label: "Social connection",
      connected: socialConnections.length > 0,
      severity: gapByField.has("social_connection") ? "required" : "ok",
      detail:
        socialConnections.length > 0
          ? `${socialConnections.length} platform${socialConnections.length === 1 ? "" : "s"}`
          : "None synced",
      gap: gapByField.get("social_connection"),
    },
    {
      id: "harvest",
      label: "Harvest",
      connected: Boolean(
        norm(client.harvest_project_id) && norm(client.harvest_client_id),
      ),
      severity: gapByField.has("harvest_project_id") ? "recommended" : "ok",
      detail:
        norm(client.harvest_project_id) && norm(client.harvest_client_id)
          ? "Linked"
          : "Incomplete",
      gap: gapByField.get("harvest_project_id"),
    },
  ];
  return rows;
}
function IntegrationIcon({
  severity,
  connected,
}: {
  severity: IntegrationRow["severity"];
  connected: boolean;
}) {
  if (connected && severity === "ok") {
    return <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />;
  }
  if (severity === "required") {
    return <XCircle size={16} className="shrink-0 text-red-400" />;
  }
  return <AlertTriangle size={16} className="shrink-0 text-amber-500" />;
}
function SeverityBadge({ severity }: { severity: IntegrationRow["severity"] }) {
  if (severity === "ok") return null;
  const label = severity === "required" ? "Required" : "Recommended";
  const classes =
    severity === "required"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : "text-amber-500 bg-amber-500/10 border-amber-500/20";
  return (
    <span className={`rounded border px-2 py-0.5 text-xs ${classes}`}>
      {label}
    </span>
  );
}
export default function ClientWorkspaceDashboard({
  data,
  userEmail,
  strategistRoster = [],
  appUrl,
}: {
  data: ClientWorkspaceInitialData;
  userEmail?: string;
  strategistRoster?: StrategistContact[];
  appUrl?: string;
}) {
  const router = useRouter();
  const [clientsListHref, setClientsListHref] = useState(CLIENT_LIST_PATH);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  useEffect(() => {
    setClientsListHref(readStoredClientListHref());
  }, []);
  const { client } = data;
  const clientId = client.id;
  const setup = evaluateClientSetup(client, {
    socialConnectionCount: data.socialConnections.length,
  });
  const setupGaps = [...setup.missingRequired, ...setup.missingRecommended];
  const integrations = buildIntegrationRows(data, setupGaps);
  const services = activeServiceLabels(getClientActiveServices(client));
  const clientThreads = data.threadEvents.filter((event) => !event.is_internal);
  const latestClientThread = clientThreads[0] ?? null;
  const showReplyAlert = shouldShowReplyAlert(client);
  const ads = data.adsSnapshot?.totals;
  const adsCtr =
    ads && ads.impressions > 0 ? (ads.clicks / ads.impressions) * 100 : null;
  const adsSpend = ads ? ads.cost_micros / 1_000_000 : null;
  const gscClicks = data.gscPageMetrics.reduce(
    (sum, row) => sum + row.clicks,
    0,
  );
  const gscImpressions = data.gscPageMetrics.reduce(
    (sum, row) => sum + row.impressions,
    0,
  );
  const gscCtr = gscImpressions > 0 ? (gscClicks / gscImpressions) * 100 : null;
  const criticalSignals = [
    ...data.adsSignals.filter((s) => s.severity === "critical").slice(0, 3),
    ...data.gscSignals.filter((s) => s.severity === "critical").slice(0, 3),
    ...data.socialSignals.filter((s) => s.severity === "critical").slice(0, 2),
  ].slice(0, 5);
  const staleSitemapUrls = data.sitemapUrls
    .filter((row) => {
      if (!row.effective_updated_at) return true;
      const ageDays =
        (Date.now() - new Date(row.effective_updated_at).getTime()) /
        (1000 * 60 * 60 * 24);
      return ageDays > 30;
    })
    .slice(0, 50);
  const tierLabel = norm(client.tier) || "Unassigned tier";
  async function handleNoReplyNeeded() {
    setAckError(null);
    setAcknowledging(true);
    try {
      await acknowledgeNoReply(client.id);
      router.push(readStoredClientListHref());
      router.refresh();
    } catch (error) {
      setAckError(
        error instanceof Error
          ? error.message
          : "Failed to mark as no reply needed",
      );
    } finally {
      setAcknowledging(false);
    }
  }
  return (
    <main className="flex-1 bg-bip-card p-6 font-sans text-white">
      
      <header className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] pb-4 md:flex-row md:items-center">
        
        <div>
          
          <Link
            href={clientsListHref}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition hover:text-white/75"
          >
            
            <ArrowLeft size={14} /> Back to clients
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {client.account_name}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            
            Account ID: #{client.id}
            {norm(client.marketing_strategist)
              ? ` · Strategist: ${client.marketing_strategist}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          
          <span className="rounded-full border border-indigo-500/20 bg-bip-accent/10 px-3 py-1 text-xs font-semibold text-bip-accent">
            
            {tierLabel}
          </span>
          {services.map((service) => (
            <span
              key={service}
              className="rounded-full border border-white/[0.08] bg-bip-card/80 px-2.5 py-1 text-xs text-white/75"
            >
              
              {service}
            </span>
          ))}
        </div>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        
        <Link
          href={`/dashboard/clients/${clientId}`}
          className="rounded-lg border border-white/[0.08] bg-bip-card/50 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-white/[0.12] hover:text-white"
        >
          
          Overview
        </Link>
        {DETAIL_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/clients/${clientId}?tab=${tab.id}`}
            className="rounded-lg border border-white/[0.08] bg-bip-card/50 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-white/[0.12] hover:text-white"
          >
            
            {tab.label}
          </Link>
        ))}
      </nav>
      {showReplyAlert && (
        <div
          className={`mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${(client.days_stale ?? 0) >= 14 ? "border-red-500/40 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}
        >
          
          <div className="flex items-start gap-3">
            
            <AlertTriangle
              className={`mt-0.5 shrink-0 ${(client.days_stale ?? 0) >= 14 ? "text-red-400" : "text-amber-500"}`}
              size={20}
            />
            <div>
              
              <h4
                className={`font-semibold ${(client.days_stale ?? 0) >= 14 ? "text-red-300" : "text-amber-400"}`}
              >
                
                Action Required: Unanswered Client Thread
              </h4>
              <p className="mt-1 text-sm text-white/75">
                
                {latestClientThread ? (
                  <>
                    
                    The client was the last to respond
                    {formatRelativeDays(latestClientThread.occurred_at)
                      ? ` (${formatRelativeDays(latestClientThread.occurred_at)})`
                      : ""}
                    :
                    <span className="italic text-white/50">
                      
                      {""} &ldquo;{previewText(latestClientThread, 120)}
                      &rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    
                    The client was the last to respond
                    {client.days_stale != null
                      ? ` (${client.days_stale} day${client.days_stale === 1 ? "" : "s"} ago)`
                      : client.last_communication_at
                        ? ` (${formatRelativeDays(client.last_communication_at) ?? "recently"})`
                        : ""}
                    . Thread preview is unavailable — sync Basecamp or open the
                    {""}
                    <Link
                      href={`/dashboard/clients/${clientId}?tab=comms`}
                      className="text-bip-accent underline-offset-2 hover:underline"
                    >
                      
                      Comms tab
                    </Link>
                    {""} for details.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            
            {latestClientThread ? (
              <NotifyStrategistButton
                client={client}
                thread={latestClientThread}
                roster={strategistRoster}
                userEmail={userEmail}
                appUrl={appUrl}
              />
            ) : null}
            <button
              type="button"
              onClick={() => void handleNoReplyNeeded()}
              disabled={acknowledging}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-600/80 bg-bip-card/80 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-slate-700/80 disabled:opacity-60"
            >
              
              {acknowledging ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              No reply needed
            </button>
            {latestClientThread &&
            openableBasecampUrl(latestClientThread.thread_url) ? (
              <a
                href={openableBasecampUrl(latestClientThread.thread_url)}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white transition ${(client.days_stale ?? 0) >= 14 ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500"}`}
              >
                
                Open in Basecamp <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      )}
      {ackError ? (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          
          {ackError}
        </div>
      ) : null}
      {criticalSignals.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-red-300">
            
            <AlertTriangle size={18} /> Critical technical alerts
          </h4>
          <ul className="space-y-1.5 text-sm text-white/75">
            
            {criticalSignals.map((signal) => (
              <li key={`${signal.id}-${signal.title}`}>• {signal.title}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        <section className="space-y-6 lg:col-span-4">
          
          <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
            
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
              
              API Integrations
            </h3>
            <ul className="space-y-3">
              
              {integrations.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  
                  <div className="flex min-w-0 items-center gap-2">
                    
                    <IntegrationIcon
                      severity={row.severity}
                      connected={row.connected}
                    />
                    <span
                      className={
                        row.connected ? "text-white/75" : "text-white/50"
                      }
                    >
                      
                      {row.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    
                    {row.connected && row.severity === "ok" && (
                      <span className="max-w-[120px] truncate font-mono text-xs text-white/50">
                        
                        {row.detail}
                      </span>
                    )}
                    <SeverityBadge severity={row.severity} />
                  </div>
                </li>
              ))}
            </ul>
            {!setup.isComplete && (
              <Link
                href={`/dashboard/clients/${clientId}?tab=onboarding`}
                className="mt-4 inline-flex text-xs font-medium text-bip-accent hover:text-bip-accent"
              >
                
                View onboarding checklist →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
            
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
              
              Account allocations
            </h3>
            <dl className="space-y-3 text-sm">
              
              <div className="flex justify-between gap-2">
                
                <dt className="text-white/50">Package hours</dt>
                <dd className="font-medium text-white/75">
                  
                  {client.total_package_hours ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                
                <dt className="text-white/50">Strategist hours</dt>
                <dd className="font-medium text-white/75">
                  
                  {client.hours_for_strategist ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                
                <dt className="text-white/50">Website</dt>
                <dd className="max-w-[160px] truncate font-medium text-white/75">
                  
                  {norm(client.website) || "—"}
                </dd>
              </div>
            </dl>
          </div>
          {data.gbpSnapshot && (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-5">
              
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/50">
                
                <Globe size={16} className="text-bip-accent" /> Google Business
                Profile
              </h3>
              <p className="text-lg font-bold text-white">
                
                {data.gbpSnapshot.rating?.toFixed(2) ?? "—"} / 5
              </p>
              <p className="mt-1 text-xs text-white/50">
                
                {data.gbpSnapshot.user_ratings_total ?? 0} reviews ·{""}
                {data.gbpReviews.length} synced
              </p>
            </div>
          )}
        </section>
        <section className="space-y-6 lg:col-span-8">
          
          {data.adsSnapshot && ads && (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-6">
              
              <div className="mb-6 flex items-center justify-between">
                
                <div className="flex items-center gap-2">
                  
                  <BarChart3 className="text-bip-accent" size={18} />
                  <h3 className="font-semibold text-white">
                    Google Ads Campaign Health
                  </h3>
                </div>
                <Link
                  href={`/dashboard/clients/${clientId}?tab=ads`}
                  className="text-xs font-medium text-bip-accent hover:text-bip-accent"
                >
                  
                  Full Ads view →
                </Link>
              </div>
              <div className="mb-6 grid grid-cols-2 gap-4 border-b border-white/[0.08] pb-6 sm:grid-cols-4">
                
                <MetricTile
                  label="Impressions"
                  value={formatCompactNumber(ads.impressions)}
                />
                <MetricTile
                  label="Clicks"
                  value={formatCompactNumber(ads.clicks)}
                />
                <MetricTile
                  label="CTR"
                  value={adsCtr != null ? formatPercent(adsCtr) : "—"}
                  accent={adsCtr != null && adsCtr >= 5 ? "emerald" : undefined}
                />
                <MetricTile
                  label="Spend"
                  value={adsSpend != null ? `$${adsSpend.toFixed(0)}` : "—"}
                />
              </div>
              <SmartAdsPlaybook
                adsSnapshot={data.adsSnapshot}
                clientName={data.client.account_name}
                embedded
                className="border-0 bg-transparent p-0"
              />
            </div>
          )}
          {(gscClicks > 0 || gscImpressions > 0) && (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-6">
              
              <div className="mb-6 flex items-center justify-between">
                
                <div className="flex items-center gap-2">
                  
                  <Search className="text-bip-accent" size={18} />
                  <h3 className="font-semibold">
                    Search Console snapshot
                  </h3>
                </div>
                <Link
                  href={`/dashboard/clients/${clientId}?tab=seo`}
                  className="text-xs font-medium text-bip-accent hover:text-bip-accent"
                >
                  
                  Full SEO view →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-4">
                
                <MetricTile
                  label="Clicks"
                  value={formatCompactNumber(gscClicks)}
                />
                <MetricTile
                  label="Impressions"
                  value={formatCompactNumber(gscImpressions)}
                />
                <MetricTile
                  label="CTR"
                  value={gscCtr != null ? formatPercent(gscCtr) : "—"}
                  accent="emerald"
                />
              </div>
            </div>
          )}
          {data.sitemapUrls.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-6">
              
              <div className="mb-4 flex items-center justify-between">
                
                <h3 className="font-semibold">
                  Sitemap URLs needing attention
                </h3>
                <Link
                  href={`/dashboard/clients/${clientId}?tab=sitemaps`}
                  className="text-xs font-medium text-bip-accent hover:text-bip-accent"
                >
                  
                  Full sitemap →
                </Link>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.08] bg-bip-card/40 p-3">
                
                <ul className="space-y-2 font-mono text-xs text-white/50">
                  
                  {(staleSitemapUrls.length > 0
                    ? staleSitemapUrls
                    : data.sitemapUrls.slice(0, 30)
                  ).map((row) => (
                    <li key={row.id} className="truncate">
                      
                      {row.loc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-white/[0.08] bg-bip-card/50 p-6">
            
            <div className="mb-4 flex items-center justify-between">
              
              <div className="flex items-center gap-2">
                
                <MessageSquare className="text-violet-400" size={18} />
                <h3 className="font-semibold">Recent communications</h3>
              </div>
              <Link
                href={`/dashboard/clients/${clientId}?tab=comms`}
                className="text-xs font-medium text-bip-accent hover:text-bip-accent"
              >
                
                Full comms →
              </Link>
            </div>
            {data.threadEvents.length === 0 ? (
              <p className="text-sm text-white/50">
                No synced Basecamp threads in the last 30 days.
              </p>
            ) : (
              <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                
                {data.threadEvents.slice(0, 8).map((event) => (
                  <article
                    key={event.id}
                    className="rounded-lg border border-white/[0.08] bg-bip-card/40 p-3"
                  >
                    
                    <div className="flex items-center justify-between gap-2 text-xs text-white/50">
                      
                      <span>
                        {event.is_internal ? "Internal" : "Client"}
                      </span>
                      <span>
                        {formatRelativeDays(event.occurred_at) ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-white/75">
                      
                      {norm(event.thread_title) || "Untitled thread"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/50">
                      {previewText(event)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            
            <Link
              href={`/dashboard/clients/${clientId}?tab=reporting`}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-bip-accent/10 px-4 py-2 text-sm font-medium text-bip-accent transition hover:bg-bip-accent/20"
            >
              
              <BarChart3 size={16} /> Open unified reporting
            </Link>
            <Link
              href={`/reports/${clientId}?range=last30`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-bip-card"
            >
              
              <Share2 size={16} /> Generate PDF report
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-lg border border-white/[0.08]/50 bg-bip-card/40 p-3">
      
      <p className="text-xs text-white/50">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${accent === "emerald" ? "text-bip-accent" : "text-white"}`}
      >
        
        {value}
      </p>
    </div>
  );
}
