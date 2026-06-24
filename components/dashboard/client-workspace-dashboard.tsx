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
  Loader2,
  Share2,
  XCircle,
  BookOpen,
  WifiOff,
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
import NotifyStrategistButton from "@/components/dashboard/notify-strategist-button";
import type { StrategistContact } from "@/lib/team/strategist-roster";
import { StrategistCockpit } from "@/components/dashboard/strategist-cockpit";
import { toCockpitViewModel } from "@/lib/dashboard/cockpit-view-model";

const DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "comms", label: "Comms" },
  { id: "onboarding", label: "Onboarding" },
  { id: "playbook", label: "Playbook" },
  { id: "connections", label: "Connections" },
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


type IntegrationDot = {
  id: string;
  label: string;
  connected: boolean;
  required: boolean;
};

function buildConnectionDots(data: ClientWorkspaceInitialData): IntegrationDot[] {
  const { client, socialConnections } = data;
  return [
    { id: "ga4", label: "GA4", connected: Boolean(norm(client.ga4_property_id)), required: false },
    { id: "sc", label: "Search Console", connected: Boolean(norm(client.sc_url)), required: true },
    { id: "ads", label: "Google Ads", connected: Boolean(norm(client.ads_customer_id)), required: true },
    { id: "gbp", label: "Google Place ID", connected: Boolean(norm(client.google_place_id)), required: false },
    { id: "basecamp", label: "Basecamp", connected: Boolean(norm(client.basecamp_project_id)), required: true },
    { id: "social", label: "Social", connected: socialConnections.length > 0, required: false },
    { id: "harvest", label: "Harvest", connected: Boolean(norm(client.harvest_project_id) && norm(client.harvest_client_id)), required: false },
  ];
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
  const connectionDots = buildConnectionDots(data);
  const services = activeServiceLabels(getClientActiveServices(client));
  const clientThreads = data.threadEvents.filter((e) => !e.is_internal);
  const latestClientThread = clientThreads[0] ?? null;
  const showReplyAlert = shouldShowReplyAlert(client);
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
        error instanceof Error ? error.message : "Failed to mark as no reply needed",
      );
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <main className="flex-1 bg-bip-card p-6 font-sans text-bip-text">
      {/* Header */}
      <header className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-bip-border pb-4 md:flex-row md:items-center">
        <div>
          <Link
            href={clientsListHref}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-bip-muted transition hover:text-bip-text"
          >
            <ArrowLeft size={14} /> Back to clients
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{client.account_name}</h1>
          <p className="mt-1 text-sm text-bip-muted">
            #{client.id}
            {norm(client.marketing_strategist) ? ` · ${client.marketing_strategist}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-indigo-500/20 bg-bip-accent/10 px-3 py-1 text-xs font-semibold text-bip-accent">
            {tierLabel}
          </span>
          {services.map((s) => (
            <span
              key={s}
              className="rounded-full border border-bip-border bg-bip-card/80 px-2.5 py-1 text-xs text-bip-text"
            >
              {s}
            </span>
          ))}
        </div>
      </header>


      {/* Tab nav */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/clients/${clientId}`}
          className="rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent"
        >
          Overview
        </Link>
        {DETAIL_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/clients/${clientId}?tab=${tab.id}`}
            className="rounded-lg border border-bip-border bg-bip-card/50 px-3 py-1.5 text-xs font-medium text-bip-text transition hover:border-bip-border hover:text-bip-text"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Comms alert */}
      {showReplyAlert && (
        <div
          className={`mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${
            (client.days_stale ?? 0) >= 14
              ? "border-red-500/40 bg-red-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
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
              <p className="mt-1 text-sm text-bip-text">
                {latestClientThread ? (
                  <>
                    Last response{" "}
                    {formatRelativeDays(latestClientThread.occurred_at)
                      ? `(${formatRelativeDays(latestClientThread.occurred_at)})`
                      : ""}
                    :{" "}
                    <span className="italic text-bip-muted">
                      &ldquo;{previewText(latestClientThread, 120)}&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    Client was last to respond
                    {client.days_stale != null
                      ? ` (${client.days_stale} day${client.days_stale === 1 ? "" : "s"} ago)`
                      : client.last_communication_at
                        ? ` (${formatRelativeDays(client.last_communication_at) ?? "recently"})`
                        : ""}
                    .{" "}
                    <Link
                      href={`/dashboard/clients/${clientId}?tab=comms`}
                      className="text-bip-accent underline-offset-2 hover:underline"
                    >
                      Open Comms tab
                    </Link>{" "}
                    for details.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {latestClientThread && (
              <NotifyStrategistButton
                client={client}
                thread={latestClientThread}
                roster={strategistRoster}
                userEmail={userEmail}
                appUrl={appUrl}
              />
            )}
            <button
              type="button"
              onClick={() => void handleNoReplyNeeded()}
              disabled={acknowledging}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-600/80 bg-bip-card/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700/80 disabled:opacity-60"
            >
              {acknowledging && <Loader2 size={14} className="animate-spin" />}
              No reply needed
            </button>
            {latestClientThread && openableBasecampUrl(latestClientThread.thread_url) && (
              <a
                href={openableBasecampUrl(latestClientThread.thread_url) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-bip-text transition ${
                  (client.days_stale ?? 0) >= 14
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                Open in Basecamp <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {ackError && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ackError}
        </div>
      )}

      {/* Connections · Account · Actions strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">

          {/* Connections */}
          <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-bip-muted">
                Connections
              </h3>
              <Link
                href={`/dashboard/clients/${clientId}?tab=connections`}
                className="text-xs text-bip-subtle hover:text-bip-accent transition-colors"
              >
                Manage →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {connectionDots.map((dot) => (
                <li key={dot.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    {dot.connected ? (
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    ) : dot.required ? (
                      <XCircle size={14} className="shrink-0 text-red-400" />
                    ) : (
                      <WifiOff size={14} className="shrink-0 text-bip-subtle" />
                    )}
                    <span className={dot.connected ? "text-bip-text" : "text-bip-subtle"}>
                      {dot.label}
                    </span>
                  </div>
                  {!dot.connected && dot.required && (
                    <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                      Required
                    </span>
                  )}
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

          {/* Account info */}
          <div className="rounded-xl border border-bip-border bg-bip-card/50 p-5">
            <h3 className="mb-4 text-xs font-semibold text-bip-muted">
              Account
            </h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-bip-muted">Package hours</dt>
                <dd className="font-medium text-bip-text">{client.total_package_hours ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-bip-muted">Strategist hours</dt>
                <dd className="font-medium text-bip-text">{client.hours_for_strategist ?? "—"}</dd>
              </div>
              {norm(client.website) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-bip-muted">Website</dt>
                  <dd className="max-w-[150px] truncate font-medium text-bip-text">
                    {norm(client.website)}
                  </dd>
                </div>
              )}
              {data.gbpSnapshot && (
                <div className="flex justify-between gap-2">
                  <dt className="text-bip-muted">GBP rating</dt>
                  <dd className="font-medium text-bip-text">
                    {data.gbpSnapshot.rating?.toFixed(1) ?? "—"} / 5
                    <span className="ml-1.5 text-xs text-bip-subtle">
                      ({data.gbpSnapshot.user_ratings_total ?? 0} reviews)
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick actions */}
          <div className="flex flex-col gap-2">
            <Link
              href={`/reports/${clientId}/draft`}
              className="inline-flex items-center gap-2 rounded-lg border border-bip-accent/20 bg-bip-accent/10 px-4 py-2.5 text-sm font-medium text-bip-accent transition hover:bg-bip-accent/20"
            >
              <BarChart3 size={15} /> Open reporting
            </Link>
            <Link
              href={`/dashboard/clients/${clientId}?tab=playbook`}
              className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-4 py-2.5 text-sm font-medium text-bip-text transition hover:bg-bip-card hover:text-bip-text"
            >
              <BookOpen size={15} /> Service playbook
            </Link>
            <Link
              href={`/reports/${clientId}?range=last30`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-4 py-2.5 text-sm font-medium text-bip-text transition hover:bg-bip-card hover:text-bip-text"
            >
              <Share2 size={15} /> Generate PDF report
            </Link>
          </div>
      </div>

      {/* Internal cockpit: channel health + focus queue */}
      <StrategistCockpit data={toCockpitViewModel(data)} />
    </main>
  );
}
