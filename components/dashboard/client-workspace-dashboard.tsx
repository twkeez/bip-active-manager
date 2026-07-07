"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  ExternalLink,
  Globe,
  HardDrive,
  Loader2,
  Pencil,
  Share2,
  TrendingDown,
  TrendingUp,
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
import { FocusCard } from "@/components/dashboard/strategist-cockpit";
import { toCockpitViewModel } from "@/lib/dashboard/cockpit-view-model";

const DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "comms", label: "Comms" },
  { id: "onboarding", label: "Onboarding" },
  { id: "playbook", label: "Playbook" },
  { id: "connections", label: "Connections" },
];

function formatRelativeDays(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function KpiCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | null;
  sub?: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </p>
      {value === null ? (
        <p className="text-sm text-neutral-300">No data</p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-neutral-900">{value}</span>
            {trend !== null && trend !== undefined && (
              <span
                className={`mb-0.5 flex items-center gap-0.5 text-xs font-semibold ${
                  trend >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
            )}
          </div>
          {sub && <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>}
        </>
      )}
    </div>
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

  // Cockpit signals
  const cockpit = toCockpitViewModel(data);
  const p1Items = cockpit.focus.filter((f) => f.priority === "P1");
  const p2Items = cockpit.focus.filter((f) => f.priority === "P2");
  const wins = cockpit.features.filter((f) => !f.title.startsWith("No clean wins"));

  // KPI data
  const totalClicks = data.gscPageMetrics.reduce((sum, m) => sum + m.clicks, 0);
  const ga4Sessions = data.ga4Snapshot?.totals.sessions ?? null;
  const prevGa4Sessions = data.ga4Snapshot?.previous_totals?.sessions ?? null;
  const sessionTrend =
    ga4Sessions !== null && prevGa4Sessions !== null && prevGa4Sessions > 0
      ? Math.round(((ga4Sessions - prevGa4Sessions) / prevGa4Sessions) * 100)
      : null;
  const adsConversions = data.adsSnapshot?.totals.conversions ?? null;
  const adsCostMicros = data.adsSnapshot?.totals.cost_micros ?? null;
  const cpa =
    adsConversions && adsCostMicros && adsConversions > 0
      ? `$${(adsCostMicros / 1_000_000 / adsConversions).toFixed(0)} CPA`
      : null;
  const gbpRating = data.gbpSnapshot?.rating ?? null;
  const gbpTotal = data.gbpSnapshot?.user_ratings_total ?? null;

  // Hours
  const pkgHours = client.total_package_hours ?? 0;
  const stratHours = client.hours_for_strategist ?? 0;
  const hoursPercent = pkgHours > 0 ? Math.min(100, (stratHours / pkgHours) * 100) : 0;

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
      className="flex-1 min-h-screen bg-neutral-50 font-sans text-neutral-900"
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-neutral-200 bg-white px-6 py-5">
        <Link
          href={clientsListHref}
          className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-400 transition hover:text-neutral-700"
        >
          <ArrowLeft size={12} /> Back to clients
        </Link>
        <div className="flex flex-wrap items-start gap-6">
          {/* Name + ID */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-neutral-900">{client.account_name}</h1>
            <p className="mt-0.5 text-sm text-neutral-400">
              #{client.id}
              {norm(client.marketing_strategist)
                ? ` · ${client.marketing_strategist}`
                : ""}
            </p>
          </div>

          {/* Status */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Status
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
            <p className="mt-1.5 text-[11px] text-neutral-400">{tierLabel}</p>
            {services.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {services.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Hours */}
          {pkgHours > 0 && (
            <div className="min-w-[160px]">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Monthly hours
              </p>
              <p className="text-sm font-semibold text-neutral-800">
                {stratHours} / {pkgHours} hrs
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-200">
                <div
                  className="h-1.5 rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${hoursPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">
                {Math.round(hoursPercent)}% used
              </p>
            </div>
          )}

          {/* Contact */}
          <div className="min-w-[190px]">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Contact
              </p>
              <button
                type="button"
                onClick={openEdit}
                className="text-neutral-300 transition hover:text-indigo-500"
                title="Edit contact"
              >
                <Pencil size={11} />
              </button>
            </div>
            {editing ? (
              <div className="space-y-1.5">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={draftDrive}
                  onChange={(e) => setDraftDrive(e.target.value)}
                  placeholder="Shared drive URL"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-indigo-500 focus:outline-none"
                />
                {saveError && (
                  <p className="text-[11px] text-red-500">{saveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveContact()}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={10} className="animate-spin" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  {displayName ?? "—"}
                </p>
                {displayEmail ? (
                  <p className="text-xs text-neutral-500">{displayEmail}</p>
                ) : (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    Add contact info
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Tab nav ─────────────────────────────────────────────── */}
      <nav className="border-b border-neutral-200 bg-white px-6">
        <div className="-mb-px flex">
          <Link
            href={`/dashboard/clients/${clientId}`}
            className="border-b-2 border-indigo-600 px-4 py-3 text-xs font-semibold text-indigo-600"
          >
            Overview
          </Link>
          {DETAIL_TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/dashboard/clients/${clientId}?tab=${tab.id}`}
              className="border-b-2 border-transparent px-4 py-3 text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
            >
              {tab.label}
            </Link>
          ))}
          {norm(client.ads_customer_id) && (
            <Link
              href={`/dashboard/clients/${clientId}?tab=ads`}
              className="border-b-2 border-transparent px-4 py-3 text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
            >
              Ads
            </Link>
          )}
        </div>
      </nav>

      {/* ── Comms alert ─────────────────────────────────────────── */}
      {showReplyAlert && (
        <div
          className={`mx-6 mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${
            (client.days_stale ?? 0) >= 14
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`mt-0.5 shrink-0 ${(client.days_stale ?? 0) >= 14 ? "text-red-500" : "text-amber-500"}`}
              size={18}
            />
            <div>
              <h4
                className={`font-semibold ${(client.days_stale ?? 0) >= 14 ? "text-red-700" : "text-amber-700"}`}
              >
                Action Required: Unanswered Client Thread
              </h4>
              <p className="mt-1 text-sm text-neutral-700">
                {latestClientThread ? (
                  <>
                    Last response{" "}
                    {formatRelativeDays(latestClientThread.occurred_at)
                      ? `(${formatRelativeDays(latestClientThread.occurred_at)})`
                      : ""}
                    :{" "}
                    <span className="italic text-neutral-500">
                      &ldquo;{previewText(latestClientThread, 120)}&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    Client was last to respond
                    {client.days_stale != null
                      ? ` (${client.days_stale} day${client.days_stale === 1 ? "" : "s"} ago)`
                      : ""}
                    .{" "}
                    <Link
                      href={`/dashboard/clients/${clientId}?tab=comms`}
                      className="text-indigo-600 underline-offset-2 hover:underline"
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
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              {acknowledging && <Loader2 size={14} className="animate-spin" />}
              No reply needed
            </button>
            {latestClientThread &&
              openableBasecampUrl(latestClientThread.thread_url) && (
                <a
                  href={openableBasecampUrl(latestClientThread.thread_url) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                    (client.days_stale ?? 0) >= 14
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-amber-500 hover:bg-amber-400"
                  }`}
                >
                  Open in Basecamp <ExternalLink size={14} />
                </a>
              )}
          </div>
        </div>
      )}

      {ackError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ackError}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="space-y-5 p-6">

        {/* Top row: Command Center + Quick Links */}
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">

          {/* Command Center */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Command Center
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Critical */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  p1Items.length > 0
                    ? "border-red-500 bg-red-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${p1Items.length > 0 ? "bg-red-500" : "bg-neutral-300"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${p1Items.length > 0 ? "text-red-700" : "text-neutral-400"}`}
                  >
                    Critical: {p1Items.length}
                  </span>
                </div>
                {p1Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No critical issues</p>
                ) : (
                  <>
                    {p1Items.slice(0, 2).map((item, i) => (
                      <p
                        key={i}
                        className="mt-1 text-xs leading-snug text-red-700"
                      >
                        {item.title}
                      </p>
                    ))}
                    {p1Items.length > 2 && (
                      <p className="mt-1 text-[11px] text-red-400">
                        +{p1Items.length - 2} more below
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Warning */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  p2Items.length > 0
                    ? "border-amber-400 bg-amber-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${p2Items.length > 0 ? "bg-amber-400" : "bg-neutral-300"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${p2Items.length > 0 ? "text-amber-700" : "text-neutral-400"}`}
                  >
                    Warning: {p2Items.length}
                  </span>
                </div>
                {p2Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No warnings</p>
                ) : (
                  <>
                    {p2Items.slice(0, 2).map((item, i) => (
                      <p
                        key={i}
                        className="mt-1 text-xs leading-snug text-amber-700"
                      >
                        {item.title}
                      </p>
                    ))}
                    {p2Items.length > 2 && (
                      <p className="mt-1 text-[11px] text-amber-500">
                        +{p2Items.length - 2} more below
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Good */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  wins.length > 0
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${wins.length > 0 ? "bg-emerald-500" : "bg-neutral-300"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${wins.length > 0 ? "text-emerald-700" : "text-neutral-400"}`}
                  >
                    Good: {wins.length}
                  </span>
                </div>
                {wins.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    Address critical items first
                  </p>
                ) : (
                  wins.slice(0, 2).map((win, i) => (
                    <p
                      key={i}
                      className="mt-1 text-xs leading-snug text-emerald-700"
                    >
                      {win.title}
                    </p>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Quick Links */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Quick Links
            </h3>
            <ul className="space-y-0.5">
              {websiteHref && (
                <li>
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <Globe size={14} className="shrink-0 text-neutral-400" />
                    Website
                    <ExternalLink size={10} className="ml-auto text-neutral-300" />
                  </a>
                </li>
              )}
              {norm(client.ads_customer_id) && (
                <li>
                  <Link
                    href={`/dashboard/clients/${clientId}?tab=ads`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <BarChart3 size={14} className="shrink-0 text-neutral-400" />
                    Google Ads
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href={`/reports/${clientId}/draft`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Share2 size={14} className="shrink-0 text-neutral-400" />
                  Reporting
                </Link>
              </li>
              <li>
                <Link
                  href={`/dashboard/clients/${clientId}?tab=playbook`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                >
                  <BookOpen size={14} className="shrink-0 text-neutral-400" />
                  Service Playbook
                </Link>
              </li>
              <li>
                {displayDrive ? (
                  <a
                    href={displayDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <HardDrive size={14} className="shrink-0 text-neutral-400" />
                    Shared Drive
                    <ExternalLink size={10} className="ml-auto text-neutral-300" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-400 transition hover:bg-neutral-50"
                  >
                    <HardDrive size={14} className="shrink-0" />
                    Add shared drive
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* KPI Scorecard */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Organic clicks"
            value={totalClicks > 0 ? totalClicks.toLocaleString() : null}
            sub="Last 30 days · GSC"
          />
          <KpiCard
            label="GA4 sessions"
            value={ga4Sessions !== null ? ga4Sessions.toLocaleString() : null}
            sub="Last 30 days"
            trend={sessionTrend}
          />
          <KpiCard
            label="Paid conversions"
            value={adsConversions !== null ? adsConversions.toLocaleString() : null}
            sub={cpa ?? "Google Ads"}
          />
          <KpiCard
            label="GBP rating"
            value={gbpRating !== null ? `${gbpRating.toFixed(1)}★` : null}
            sub={gbpTotal !== null ? `${gbpTotal.toLocaleString()} reviews` : undefined}
          />
        </div>

        {/* Bottom: Focus Queue + Recent Activity */}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">

          {/* Focus Queue */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Focus Queue
              </h2>
              <span className="text-[11px] text-neutral-300">
                Internal only
                {cockpit.client.syncedAt ? ` · synced ${cockpit.client.syncedAt}` : ""}
              </span>
            </div>
            {cockpit.focus.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
                No open signals this period.
              </div>
            ) : (
              cockpit.focus.map((item) => (
                <FocusCard key={item.id} item={item} />
              ))
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Recent Activity
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-white">
              {data.threadEvents.length === 0 ? (
                <p className="p-5 text-sm text-neutral-400">No recent activity.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {data.threadEvents.slice(0, 7).map((event) => (
                    <li key={event.id} className="flex gap-3 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
                        {(event.author_email ?? "?")[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-neutral-700">
                            {(event.author_email ?? "").split("@")[0]}
                          </p>
                          <p className="shrink-0 text-[11px] text-neutral-400">
                            {formatRelativeDays(event.occurred_at)}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                          {previewText(event, 80)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.threadEvents.length > 7 && (
                <div className="border-t border-neutral-100 px-4 py-2.5 text-center">
                  <Link
                    href={`/dashboard/clients/${clientId}?tab=comms`}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    View all in Comms
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
