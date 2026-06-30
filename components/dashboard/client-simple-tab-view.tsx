"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Loader, Pencil, RefreshCw, ScanSearch, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  activeServiceLabels,
  getClientActiveServices,
  norm,
} from "@/lib/clients/service-active";
import {
  CLIENT_LIST_PATH,
  readStoredClientListHref,
} from "@/lib/clients/client-list-view-state";
import type {
  ClientDetailTab,
  ClientWorkspaceInitialData,
} from "@/lib/dashboard/client-workspace-types";
import ClientPlaybookView from "@/components/playbook/client-playbook-view";
import ClientRunOfShowView from "@/components/dashboard/client-run-of-show-view";
import ClientOnboardingView from "@/components/dashboard/client-onboarding-view";
import ClientProfileView from "@/components/dashboard/client-profile-view";
import type { StrategistContact } from "@/lib/team/strategist-roster";
import { openableBasecampUrl, previewText } from "@/lib/basecamp/display";

// Tabs handled by this clean shell (data-heavy tabs stay in legacy system)
const SIMPLE_TABS = new Set<ClientDetailTab>([
  "overview",
  "profile",
  "onboarding",
  "connections",
  "comms",
  "playbook",
]);

const ALL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "comms", label: "Comms" },
  { id: "onboarding", label: "Onboarding" },
  { id: "playbook", label: "Playbook" },
  { id: "connections", label: "Connections" },
];

function formatRelative(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// ─── Tab content components ───────────────────────────────────────────────────

function DataRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-bip-border py-2.5 last:border-0">
      <dt className="text-xs text-bip-muted shrink-0">{label}</dt>
      <dd className={`text-xs text-right ${mono ? "font-mono text-bip-muted" : "text-bip-muted"} truncate max-w-[240px]`}>
        {value || "—"}
      </dd>
    </div>
  );
}

type ConnectionFields = {
  sc_url: string;
  ga4_property_id: string;
  ga4_id: string;
  google_place_id: string;
  ads_customer_id: string;
  website: string;
  basecamp_project_id: string;
  harvest_project_id: string;
  harvest_client_id: string;
};

function EditableField({
  label,
  fieldKey,
  value,
  editing,
  draft,
  onChange,
  mono,
}: {
  label: string;
  fieldKey: keyof ConnectionFields;
  value: string | null | undefined;
  editing: boolean;
  draft: ConnectionFields;
  onChange: (k: keyof ConnectionFields, v: string) => void;
  mono?: boolean;
}) {
  if (!editing) {
    return <DataRow label={label} value={norm(value)} mono={mono} />;
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-bip-border py-2 last:border-0">
      <label className="text-xs text-bip-muted shrink-0">{label}</label>
      <input
        type="text"
        value={draft[fieldKey]}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder="—"
        className={`text-right text-xs bg-bip-hover border border-bip-border rounded px-2 py-1 text-bip-text focus:outline-none focus:border-bip-accent/50 w-48 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

type SyncJob = { label: string; endpoint: string; requiredField: string | null };

function DataSyncPanel({ clientId, client }: { clientId: number; client: Record<string, unknown> }) {
  const jobs: SyncJob[] = [
    { label: "Search Console", endpoint: "/api/seo/search-console/sync", requiredField: "sc_url" },
    { label: "GA4", endpoint: "/api/ga4/sync", requiredField: "ga4_property_id" },
    { label: "Google Ads", endpoint: "/api/ads/sync", requiredField: "ads_customer_id" },
    { label: "Social (Facebook)", endpoint: "/api/social/sync", requiredField: null },
    { label: "Google Business Profile", endpoint: "/api/gbp/sync", requiredField: "google_place_id" },
  ];
  const [statuses, setStatuses] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function runSync(job: SyncJob) {
    setStatuses((s) => ({ ...s, [job.label]: "running" }));
    setErrors((e) => { const n = { ...e }; delete n[job.label]; return n; });
    try {
      const res = await fetch(job.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setStatuses((s) => ({ ...s, [job.label]: "done" }));
    } catch (e) {
      setStatuses((s) => ({ ...s, [job.label]: "error" }));
      setErrors((prev) => ({ ...prev, [job.label]: e instanceof Error ? e.message : "Sync failed" }));
    }
  }

  return (
    <div className="bip-card p-5">
      <p className="bip-section-label mb-3">Data Sync</p>
      <div className="flex flex-col gap-2">
        {jobs.map((job) => {
          const hasConfig = job.requiredField ? Boolean((client[job.requiredField] as string | null)?.trim()) : true;
          const status = statuses[job.label] ?? "idle";
          return (
            <div key={job.label} className="flex items-center justify-between gap-4 py-1">
              <div>
                <span className="text-xs text-bip-muted">{job.label}</span>
                {errors[job.label] && (
                  <p className="text-[10px] text-red-400 mt-0.5">{errors[job.label]}</p>
                )}
                {status === "done" && (
                  <p className="text-[10px] text-green-400 mt-0.5">Synced just now</p>
                )}
              </div>
              <button
                onClick={() => void runSync(job)}
                disabled={!hasConfig || status === "running"}
                title={!hasConfig ? `Set ${job.requiredField} in Connections first` : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:text-bip-text hover:border-bip-border disabled:opacity-30 transition-colors"
              >
                {status === "running" ? (
                  <><Loader size={11} className="animate-spin" /> Syncing…</>
                ) : (
                  <><RefreshCw size={11} /> Sync</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapsUrlLookup({ clientId, onFound }: { clientId: number; onFound: (placeId: string) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);

  async function lookup() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setFound(null);
    try {
      const res = await fetch("/api/places/from-maps-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapsUrl: url.trim(), clientId }),
      });
      const json = await res.json() as { place_id?: string; name?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      if (json.place_id) {
        setFound(json.place_id);
        onFound(json.place_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-bip-border">
      <p className="text-[0.65rem] text-bip-subtle mb-2">Or paste a Google Maps URL to look up the Place ID</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setFound(null); setError(null); }}
          placeholder="https://www.google.com/maps/place/..."
          className="flex-1 text-xs bg-bip-hover border border-bip-border rounded px-2 py-1.5 text-bip-muted placeholder-bip-subtle focus:outline-none focus:border-bip-accent/50 font-mono"
        />
        <button
          onClick={() => void lookup()}
          disabled={loading || !url.trim()}
          className="text-xs px-3 py-1.5 rounded bg-bip-accent/20 text-bip-accent hover:bg-bip-accent/30 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {loading ? "Looking up…" : "Get Place ID"}
        </button>
      </div>
      {found && <p className="mt-1.5 text-xs text-green-400">Found: <span className="font-mono">{found}</span> — pre-filled above</p>}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ConnectionsTab({ data, onSaved }: { data: ClientWorkspaceInitialData; onSaved?: () => void }) {
  const { client, socialConnections } = data;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{
    ga4_id: string | null;
    google_place_id: string | null;
    sources: Record<string, string>;
  } | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  async function discover() {
    setDiscovering(true);
    setDiscoverError(null);
    setDiscovered(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/discover`);
      const json = await res.json() as { ga4_id?: string | null; google_place_id?: string | null; sources?: Record<string, string>; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Discovery failed");
      const result = { ga4_id: json.ga4_id ?? null, google_place_id: json.google_place_id ?? null, sources: json.sources ?? {} };
      setDiscovered(result);
      if (result.ga4_id || result.google_place_id) {
        setDraft((d) => ({
          ...d,
          ...(result.ga4_id ? { ga4_id: result.ga4_id } : {}),
          ...(result.google_place_id ? { google_place_id: result.google_place_id } : {}),
        }));
        setEditing(true);
      }
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  const blankDraft = (): ConnectionFields => ({
    sc_url: client.sc_url ?? "",
    ga4_property_id: client.ga4_property_id ?? "",
    ga4_id: client.ga4_id ?? "",
    google_place_id: client.google_place_id ?? "",
    ads_customer_id: client.ads_customer_id ?? "",
    website: client.website ?? "",
    basecamp_project_id: client.basecamp_project_id ?? "",
    harvest_project_id: client.harvest_project_id ?? "",
    harvest_client_id: client.harvest_client_id ?? "",
  });

  const [draft, setDraft] = useState<ConnectionFields>(blankDraft);

  function startEdit() {
    setDraft(blankDraft());
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  function updateDraft(k: keyof ConnectionFields, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(draft)) {
        body[k] = v.trim() || null;
      }
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }
      setEditing(false);
      onSaved?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const ef = (label: string, fieldKey: keyof ConnectionFields, mono = false) => (
    <EditableField
      label={label}
      fieldKey={fieldKey}
      value={(client as Record<string, unknown>)[fieldKey] as string | null}
      editing={editing}
      draft={draft}
      onChange={updateDraft}
      mono={mono}
    />
  );

  return (
    <div className="space-y-5">
      {/* Edit / Save controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-bip-subtle">Connection IDs used by integrations</p>
        {editing ? (
          <div className="flex items-center gap-2">
            {saveError && <span className="text-xs text-red-400">{saveError}</span>}
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:text-bip-text transition"
            >
              <X size={12} /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent hover:bg-bip-accent/20 transition disabled:opacity-50"
            >
              <Check size={12} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void discover()}
              disabled={discovering || !client.website}
              title={!client.website ? "Set a website URL in the Ads section first" : "Scan website for GA4 ID and Place ID"}
              className="inline-flex items-center gap-1 rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:text-bip-text transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ScanSearch size={12} /> {discovering ? "Scanning…" : "Auto-discover"}
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:text-bip-text transition"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        )}
      </div>

      {discoverError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {discoverError}
        </p>
      )}

      {discovered && !discoverError && (
        <div className="rounded-lg border border-bip-accent/20 bg-bip-accent/5 px-3 py-2.5 text-xs space-y-1">
          {discovered.ga4_id ? (
            <p className="text-bip-muted">
              <span className="text-bip-accent font-medium">GA4 ID found:</span> {discovered.ga4_id}
              <span className="ml-2 text-bip-subtle">via {discovered.sources.ga4_id}</span>
            </p>
          ) : (
            <p className="text-bip-muted">GA4 ID — not found on page</p>
          )}
          {discovered.google_place_id ? (
            <p className="text-bip-muted">
              <span className="text-bip-accent font-medium">Place ID found:</span> {discovered.google_place_id}
              <span className="ml-2 text-bip-subtle">via {discovered.sources.google_place_id}</span>
            </p>
          ) : (
            <p className="text-bip-muted">Place ID — not found on page</p>
          )}
          {discovered.ga4_id || discovered.google_place_id ? (
            <p className="text-bip-subtle pt-0.5">Fields pre-filled below — review and save.</p>
          ) : (
            <p className="text-bip-muted">Nothing discoverable found on the website.</p>
          )}
        </div>
      )}

      <div className="bip-card p-5">
        <p className="bip-section-label mb-3">Google</p>
        <dl>
          {ef("Search Console URL", "sc_url")}
          {ef("GA4 Property ID", "ga4_property_id", true)}
          {ef("GA4 ID", "ga4_id", true)}
          {ef("Google Place ID (GBP)", "google_place_id", true)}
        </dl>
        {editing && (
          <MapsUrlLookup
            clientId={client.id}
            onFound={(placeId) => updateDraft("google_place_id", placeId)}
          />
        )}
      </div>

      {!editing && <DataSyncPanel clientId={client.id} client={client as unknown as Record<string, unknown>} />}

      <div className="bip-card p-5">
        <p className="bip-section-label mb-3">Ads</p>
        <dl>
          {ef("Ads Customer ID", "ads_customer_id", true)}
          {ef("Website", "website")}
        </dl>
      </div>

      <div className="bip-card p-5">
        <p className="bip-section-label mb-3">Project Management</p>
        <dl>
          {ef("Basecamp Project ID", "basecamp_project_id", true)}
          {!editing && norm(client.basecamp_project_id) && (
            <div className="mt-2 pb-2">
              <a
                href={`https://basecamp.com/2175055/projects/${client.basecamp_project_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-bip-accent hover:underline"
              >
                Open in Basecamp <ExternalLink size={11} />
              </a>
            </div>
          )}
          {ef("Harvest Project ID", "harvest_project_id", true)}
          {ef("Harvest Client ID", "harvest_client_id", true)}
        </dl>
      </div>

      {socialConnections.length > 0 && (
        <div className="bip-card p-5">
          <p className="bip-section-label mb-3">Social Connections</p>
          <ul className="space-y-1.5">
            {socialConnections.map((sc) => (
              <li key={sc.id} className="text-xs text-bip-muted">
                {sc.platform} — {sc.account_name ?? sc.account_username ?? sc.page_id ?? "connected"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CommsTab({ data }: { data: ClientWorkspaceInitialData }) {
  const { client, threadEvents } = data;
  const clientThreads = threadEvents.filter((e) => !e.is_internal);
  const latestClient = clientThreads[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className="bip-card p-5">
        <p className="bip-section-label mb-3">Status</p>
        <dl>
          <DataRow
            label="Awaiting reply"
            value={client.needs_reply ? `Yes — client last responded ${formatRelative(client.last_communication_at)}` : "No"}
          />
          <DataRow label="Days since last communication" value={client.days_stale != null ? `${client.days_stale} day${client.days_stale !== 1 ? "s" : ""}` : undefined} />
          <DataRow label="Last communication" value={formatRelative(client.last_communication_at)} />
          <DataRow label="Last message from" value={client.last_event_is_internal == null ? undefined : client.last_event_is_internal ? "Internal" : "Client"} />
        </dl>
        {latestClient && openableBasecampUrl(latestClient.thread_url) && (
          <a
            href={openableBasecampUrl(latestClient.thread_url) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-3 py-2 text-xs text-bip-muted hover:text-bip-text transition-colors"
          >
            Open latest thread in Basecamp <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Recent threads */}
      {threadEvents.length > 0 && (
        <div className="bip-card overflow-hidden">
          <p className="bip-section-label px-5 pt-5 pb-3">Recent threads</p>
          <ul className="divide-y divide-bip-border">
            {threadEvents.slice(0, 12).map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${event.is_internal ? "text-bip-subtle" : "text-bip-accent/70"}`}>
                      {event.is_internal ? "Internal" : "Client"}
                    </span>
                    <span className="text-[10px] text-bip-subtle">{formatRelative(event.occurred_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-bip-text truncate">
                    {norm(event.thread_title) || "Untitled thread"}
                  </p>
                  <p className="mt-0.5 text-xs text-bip-muted line-clamp-2">
                    {previewText(event, 120)}
                  </p>
                </div>
                {openableBasecampUrl(event.thread_url) && (
                  <a
                    href={openableBasecampUrl(event.thread_url) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 mt-0.5 text-bip-subtle hover:text-bip-accent transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {threadEvents.length === 0 && (
        <p className="text-sm text-bip-muted">No synced Basecamp threads in the last 30 days.</p>
      )}
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

type Props = {
  data: ClientWorkspaceInitialData;
  activeTab: ClientDetailTab;
  userEmail?: string;
  strategistRoster?: StrategistContact[];
  appUrl?: string;
};

export default function ClientSimpleTabView({
  data,
  activeTab,
  userEmail,
  strategistRoster = [],
  appUrl,
}: Props) {
  const { client } = data;
  const clientId = client.id;
  const router = useRouter();
  const [clientsListHref, setClientsListHref] = useState(CLIENT_LIST_PATH);
  useEffect(() => { setClientsListHref(readStoredClientListHref()); }, []);

  const services = activeServiceLabels(getClientActiveServices(client));
  const tierLabel = norm(client.tier) || "Unassigned tier";

  function renderContent() {
    switch (activeTab) {
      case "overview":
        return (
          <ClientRunOfShowView
            client={client}
            onOpenTab={(tab) => {
              if (tab === "edit") {
                router.push(`/dashboard/clients/${clientId}?tab=profile`);
                return;
              }
              router.push(`/dashboard/clients/${clientId}?tab=${tab}`);
            }}
            onEditClient={() => router.push(`/dashboard/clients/${clientId}?tab=profile`)}
            onGraduated={() => router.refresh()}
          />
        );
      case "profile":
        return (
          <ClientProfileView
            form={client}
            recentThreads={data.threadEvents.filter((e) => !e.is_internal)}
          />
        );
      case "onboarding":
        return (
          <ClientOnboardingView
            clientId={client.id}
            recentThreads={data.threadEvents.filter((e) => !e.is_internal)}
            onOpenTab={(tab) => {
              if (tab === "edit") return;
              router.push(`/dashboard/clients/${clientId}?tab=${tab}`);
            }}
            onEditClient={() => router.push(`/dashboard/clients/${clientId}?tab=profile`)}
            onGraduated={() => router.refresh()}
          />
        );
      case "connections":
        return <ConnectionsTab data={data} onSaved={() => router.refresh()} />;
      case "comms":
        return <CommsTab data={data} />;
      case "playbook":
        return <ClientPlaybookView client={client} />;
      default:
        return null;
    }
  }

  const content = renderContent();

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
            <span key={s} className="rounded-full border border-bip-border bg-bip-card/80 px-2.5 py-1 text-xs text-bip-text">
              {s}
            </span>
          ))}
        </div>
      </header>

      {/* Tab nav */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/clients/${clientId}`}
          className="rounded-lg border border-bip-border bg-bip-card/50 px-3 py-1.5 text-xs font-medium text-bip-text transition hover:text-bip-text"
        >
          Overview
        </Link>
        {ALL_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/clients/${clientId}?tab=${tab.id}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              tab.id === activeTab
                ? "border-bip-accent/40 bg-bip-accent/10 text-bip-accent"
                : "border-bip-border bg-bip-card/50 text-bip-text hover:text-bip-text"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Tab content */}
      <div className="max-w-2xl">
        {content}
      </div>
    </main>
  );
}

export { SIMPLE_TABS };
