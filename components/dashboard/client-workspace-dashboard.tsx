"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ExternalLink,
  FileBarChart,
  Globe,
  HardDrive,
  Loader2,
  Pencil,
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
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import NotifyStrategistButton from "@/components/dashboard/notify-strategist-button";
import type { StrategistContact } from "@/lib/team/strategist-roster";
import { ConnectionsTab } from "@/components/dashboard/client-simple-tab-view";

function formatRelativeDays(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

// Tinted tactile action card — opens a tool preloaded for this client.
function ActionCard({
  href,
  icon: Icon,
  label,
  sub,
  tint,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  sub: string;
  tint: "indigo" | "purple" | "blue";
}) {
  const tints = {
    indigo: "bg-indigo-50 text-indigo-600",
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
  }[tint];
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tints}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold tracking-tight text-slate-900">{label}</span>
        <span className="block text-xs font-medium text-slate-500">{sub}</span>
      </span>
      <ArrowUpRight
        size={16}
        className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-900"
      />
    </Link>
  );
}

export default function ClientWorkspaceDashboard({
  data,
  userEmail,
  strategistRoster = [],
  appUrl,
  isAdminUser = false,
}: {
  data: ClientWorkspaceInitialData;
  userEmail?: string;
  strategistRoster?: StrategistContact[];
  appUrl?: string;
  isAdminUser?: boolean;
}) {
  const router = useRouter();
  const [clientsListHref, setClientsListHref] = useState(CLIENT_LIST_PATH);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  // Contact / drive edit state
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftDrive, setDraftDrive] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);
  const [displayDrive, setDisplayDrive] = useState<string | null>(null);

  useEffect(() => {
    setClientsListHref(readStoredClientListHref());
    const c = data.client;
    setDisplayName(c.contact_name ?? null);
    setDisplayEmail(c.contact_email ?? null);
    setDisplayDrive(c.shared_drive_url ?? null);
    setDraftName(c.contact_name ?? "");
    setDraftEmail(c.contact_email ?? "");
    setDraftDrive(c.shared_drive_url ?? "");
  }, [data.client]);

  const { client } = data;
  const clientId = client.id;
  const services = activeServiceLabels(getClientActiveServices(client));
  const clientThreads = data.threadEvents.filter((e) => !e.is_internal);
  const latestClientThread = clientThreads[0] ?? null;
  const showReplyAlert = shouldShowReplyAlert(client);
  const tierLabel = norm(client.tier) || "Unassigned tier";
  const urgent = (client.days_stale ?? 0) >= 14;

  // Hours
  const pkgHours = client.total_package_hours ?? 0;
  const stratHours = client.hours_for_strategist ?? 0;
  const hoursPercent = pkgHours > 0 ? Math.min(100, (stratHours / pkgHours) * 100) : 0;

  // Single human-readable comms status line.
  const lastCommRelative = formatRelativeDays(client.last_communication_at);
  const commsBadge = client.needs_reply
    ? {
        label: `Client replied ${lastCommRelative ?? "recently"} • Action needed`,
        className: urgent
          ? "bg-red-50 text-red-700 border-red-200/60"
          : "bg-amber-50 text-amber-700 border-amber-200/60",
      }
    : client.last_communication_at
      ? {
          label: `${client.last_event_is_internal ? "We" : "Client"} replied ${lastCommRelative ?? "recently"} • All caught up`,
          className: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
        }
      : {
          label: "No recent messages",
          className: "bg-slate-50 text-slate-500 border-slate-200/60",
        };

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

  function openEdit() {
    setDraftName(displayName ?? "");
    setDraftEmail(displayEmail ?? "");
    setDraftDrive(displayDrive ?? "");
    setSaveError(null);
    setEditing(true);
  }

  async function handleSaveContact() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: draftName.trim() || null,
          contact_email: draftEmail.trim() || null,
          shared_drive_url: draftDrive.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Save failed");
      }
      setDisplayName(draftName.trim() || null);
      setDisplayEmail(draftEmail.trim() || null);
      setDisplayDrive(draftDrive.trim() || null);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const websiteUrl = norm(client.website);
  const websiteHref = websiteUrl
    ? websiteUrl.startsWith("http")
      ? websiteUrl
      : `https://${websiteUrl}`
    : null;

  return (
    <main
      data-theme="light"
      className="min-h-screen flex-1 bg-slate-50/50 font-sans text-slate-900"
    >
      <div className="mx-auto max-w-7xl space-y-5 p-6">

        {/* ── Hero header card ──────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <Link
            href={clientsListHref}
            className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={12} /> Back to clients
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-6">
            {/* Identity */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {client.account_name}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                #{client.id}
                {norm(client.marketing_strategist) ? ` · ${client.marketing_strategist}` : ""}
                {` · ${tierLabel}`}
              </p>

              {/* Contact */}
              <div className="mt-3">
                {editing ? (
                  <div className="max-w-xs space-y-1.5">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Contact name"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      value={draftDrive}
                      onChange={(e) => setDraftDrive(e.target.value)}
                      placeholder="Shared drive URL"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                    />
                    {saveError && <p className="text-[11px] text-red-500">{saveError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveContact()}
                        disabled={saving}
                        className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                      >
                        {saving && <Loader2 size={10} className="animate-spin" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="group inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-900"
                  >
                    {displayName || displayEmail ? (
                      <>
                        {displayName ?? displayEmail}
                        {displayName && displayEmail ? ` · ${displayEmail}` : ""}
                      </>
                    ) : (
                      "Add contact info"
                    )}
                    <Pencil size={10} className="text-slate-300 group-hover:text-slate-500" />
                  </button>
                )}
              </div>

              {/* Service tags */}
              {services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {services.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly hours widget */}
            {pkgHours > 0 && (
              <div className="w-56 shrink-0">
                <p className="text-xs font-medium text-slate-500">Monthly hours</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {stratHours}
                  <span className="text-sm font-medium text-slate-500"> / {pkgHours} hrs</span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                    style={{ width: `${hoursPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {Math.round(hoursPercent)}% used
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Compact alert ─────────────────────────────────────── */}
        {showReplyAlert && (
          <div
            className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center ${
              urgent ? "border-red-200/80 bg-red-50/70" : "border-amber-200/80 bg-amber-50/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <AlertTriangle
                size={16}
                className={`shrink-0 ${urgent ? "text-red-500" : "text-amber-500"}`}
              />
              <p className="min-w-0 truncate text-sm">
                <span className={`font-bold ${urgent ? "text-red-700" : "text-amber-700"}`}>
                  Awaiting reply
                  {lastCommRelative ? ` · ${lastCommRelative}` : ""}
                </span>
                {latestClientThread && (
                  <span className="ml-2 truncate text-xs font-medium italic text-slate-500">
                    &ldquo;{previewText(latestClientThread, 90)}&rdquo;
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 disabled:opacity-60"
              >
                {acknowledging && <Loader2 size={12} className="animate-spin" />}
                No reply needed
              </button>
              {latestClientThread && openableBasecampUrl(latestClientThread.thread_url) && (
                <a
                  href={openableBasecampUrl(latestClientThread.thread_url) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition ${
                    urgent ? "bg-red-600 hover:bg-red-500" : "bg-amber-500 hover:bg-amber-400"
                  }`}
                >
                  Open in Basecamp <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {ackError && (
          <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700">
            {ackError}
          </div>
        )}

        {/* ── Action cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ActionCard
            href={`/reports/${clientId}`}
            icon={FileBarChart}
            label="Reporting"
            sub="Build this client's report"
            tint="indigo"
          />
          <ActionCard
            href={`/social-planner?client=${clientId}`}
            icon={CalendarDays}
            label="Social Media"
            sub="Calendar builder for this practice"
            tint="purple"
          />
          {isAdminUser && norm(client.ads_customer_id) && (
            <ActionCard
              href={`/ads-diagnostic?customer=${encodeURIComponent(norm(client.ads_customer_id) ?? "")}`}
              icon={Activity}
              label="Ads Diagnostics"
              sub="Deep-dive this ads account"
              tint="blue"
            />
          )}
        </div>

        {/* ── Main split ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Communication & Activity */}
          <section className="lg:col-span-8">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold tracking-tight text-slate-900">Communication</h2>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${commsBadge.className}`}
                  >
                    {commsBadge.label}
                  </span>
                  {latestClientThread && openableBasecampUrl(latestClientThread.thread_url) && (
                    <a
                      href={openableBasecampUrl(latestClientThread.thread_url) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      Open thread <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              {/* Message feed */}
              {data.threadEvents.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No synced messages in the last 30 days.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.threadEvents.slice(0, 10).map((event) => (
                    <li key={event.id} className="flex gap-3 px-5 py-3.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          event.is_internal
                            ? "bg-slate-100 text-slate-500"
                            : "bg-indigo-50 text-indigo-600"
                        }`}
                      >
                        {(event.author_email ?? "?")[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-700">
                            {(event.author_email ?? "").split("@")[0]}
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {event.is_internal ? "Internal" : "Client"}
                            </span>
                          </p>
                          <p className="shrink-0 text-xs font-medium text-slate-400">
                            {formatRelativeDays(event.occurred_at)}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {previewText(event, 110)}
                        </p>
                      </div>
                      {openableBasecampUrl(event.thread_url) && (
                        <a
                          href={openableBasecampUrl(event.thread_url) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 shrink-0 text-slate-300 transition hover:text-slate-700"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data.threadEvents.length > 10 && (
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <Link
                    href={`/dashboard/clients/${clientId}?tab=comms`}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    View full history
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Quick tools column */}
          <div className="space-y-5 lg:col-span-4">

            {/* Quick Links widget */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-900">Quick Links</h3>
              <ul className="space-y-0.5">
                {websiteHref && (
                  <li>
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Globe size={14} className="shrink-0 text-slate-400" />
                      Website
                      <ExternalLink size={10} className="ml-auto text-slate-300" />
                    </a>
                  </li>
                )}
                {norm(client.ads_customer_id) && (
                  <li>
                    <Link
                      href={`/dashboard/clients/${clientId}?tab=ads`}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <BarChart3 size={14} className="shrink-0 text-slate-400" />
                      Google Ads
                    </Link>
                  </li>
                )}
                <li>
                  {displayDrive ? (
                    <a
                      href={displayDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <HardDrive size={14} className="shrink-0 text-slate-400" />
                      Shared Drive
                      <ExternalLink size={10} className="ml-auto text-slate-300" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-50"
                    >
                      <HardDrive size={14} className="shrink-0" />
                      Add shared drive
                    </button>
                  )}
                </li>
              </ul>
            </div>

            {/* Connections */}
            <div>
              <h3 className="mb-3 text-sm font-bold tracking-tight text-slate-900">Connections</h3>
              <ConnectionsTab data={data} onSaved={() => router.refresh()} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
