"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Loader2,
  Share2,
  BookOpen,
} from "lucide-react";
import { previewText, openableBasecampUrl } from "@/lib/basecamp/display";
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
        {norm(client.ads_customer_id) && (
          <Link
            href={`/dashboard/clients/${clientId}?tab=ads`}
            className="rounded-lg border border-bip-border bg-bip-card/50 px-3 py-1.5 text-xs font-medium text-bip-text transition hover:border-bip-border hover:text-bip-text"
          >
            Ads
          </Link>
        )}
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
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-hover disabled:opacity-60"
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

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/reports/${clientId}/draft`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/20 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20"
        >
          <BarChart3 size={13} /> Open reporting
        </Link>
        <Link
          href={`/dashboard/clients/${clientId}?tab=playbook`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text transition hover:bg-bip-card"
        >
          <BookOpen size={13} /> Service playbook
        </Link>
        <Link
          href={`/reports/${clientId}?range=last30`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text transition hover:bg-bip-card"
        >
          <Share2 size={13} /> Generate PDF report
        </Link>
        <Link
          href={`/dashboard/clients/${clientId}?tab=connections`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-text transition hover:bg-bip-card"
        >
          Connections
        </Link>
      </div>

      {/* Internal cockpit: channel health + focus queue */}
      <StrategistCockpit data={toCockpitViewModel(data)} />
    </main>
  );
}
