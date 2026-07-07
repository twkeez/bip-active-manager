"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toCockpitViewModel } from "@/lib/dashboard/cockpit-view-model";
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import type { ClientRow, BasecampThreadEvent } from "@/lib/types/client";
import { norm, isServiceActive, activeServiceLabels, getClientActiveServices } from "@/lib/clients/service-active";
import { previewText, openableBasecampUrl } from "@/lib/basecamp/display";
import { dueStatus } from "@/lib/site-audit/seo-audit-schedule";
import { matchStrategistByName, type StrategistContact } from "@/lib/team/strategist-roster";
import type { ClientSeoAuditScheduleWithClient, ClientSeoAudit } from "@/lib/site-audit/seo-audit-types";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";
import SeoAuditEditor from "@/components/seo-audit/seo-audit-editor";
import { ArrowLeft, Bell, BarChart2, ExternalLink, FileText, Loader2, Play } from "lucide-react";
import { getClientServiceTierDefs } from "@/lib/playbook/client-tiers";
import { runVerifications } from "@/lib/playbook/verify";
import { runSeoPlatformChecks, type PlatformCheck } from "@/lib/playbook/workspace-verify";
import type { PlaybookItem } from "@/lib/playbook/types";

type ClientStub = Pick<ClientRow, "id" | "account_name" | "marketing_strategist" | "tier">;

// ── Flagging logic ────────────────────────────────────────────────────────────
// Red flag: message is from a client (not internal), or from Hannah or Ashley.
const FLAG_NAMES = ["hannah", "ashley"];

function isFlagged(event: BasecampThreadEvent): boolean {
  if (!event.is_internal) return true;
  const email = (event.author_email ?? "").toLowerCase();
  return FLAG_NAMES.some((n) => email.includes(n));
}

// ── Thread grouping ───────────────────────────────────────────────────────────
type Thread = {
  threadId: number;
  title: string | null;
  url: string | null;
  messages: BasecampThreadEvent[];
  hasFlagged: boolean;
  latestAt: string;
};

function groupIntoThreads(events: BasecampThreadEvent[]): Thread[] {
  const map = new Map<number, Thread>();
  for (const event of events) {
    const threadId = event.parent_recording_id ?? event.basecamp_recording_id;
    if (!map.has(threadId)) {
      map.set(threadId, {
        threadId,
        title: event.thread_title,
        url: event.thread_url,
        messages: [],
        hasFlagged: false,
        latestAt: event.occurred_at,
      });
    }
    const thread = map.get(threadId)!;
    thread.messages.push(event);
    if (isFlagged(event)) thread.hasFlagged = true;
    if (event.occurred_at > thread.latestAt) {
      thread.latestAt = event.occurred_at;
      // keep the thread url pointing to the most recent message's context
      if (event.thread_url) thread.url = event.thread_url;
    }
  }
  // sort messages within each thread oldest → newest
  for (const thread of map.values()) {
    thread.messages.sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
  }
  // sort threads newest first
  return [...map.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelative(value: string): string {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function authorLabel(email: string | null): string {
  if (!email) return "?";
  return email.split("@")[0] ?? email;
}

function avatarInitial(email: string | null): string {
  return ((email ?? "?")[0] ?? "?").toUpperCase();
}

// ── Client Settings tab ───────────────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  {
    label: "Connections",
    fields: [
      { key: "website",           label: "Website URL",               placeholder: "https://example.com" },
      { key: "sc_url",            label: "Search Console property",   placeholder: "sc-domain:example.com" },
      { key: "ga4_property_id",   label: "GA4 property ID",           placeholder: "properties/123456789" },
      { key: "gtm_container_id",  label: "GTM container ID",          placeholder: "GTM-XXXXXX" },
      { key: "google_place_id",   label: "Google Place ID",           placeholder: "ChIJ…" },
      { key: "ads_customer_id",   label: "Google Ads customer ID",    placeholder: "123-456-7890" },
    ],
  },
  {
    label: "Integrations",
    fields: [
      { key: "basecamp_project_id", label: "Basecamp project ID",  placeholder: "" },
      { key: "harvest_project_id",  label: "Harvest project ID",   placeholder: "" },
      { key: "harvest_client_id",   label: "Harvest client ID",    placeholder: "" },
      { key: "shared_drive_url",    label: "Shared Drive URL",     placeholder: "https://drive.google.com/…" },
    ],
  },
  {
    label: "Contact",
    fields: [
      { key: "contact_name",  label: "Contact name",  placeholder: "" },
      { key: "contact_email", label: "Contact email", placeholder: "" },
    ],
  },
] as const;

type SettingsKey = (typeof SETTINGS_SECTIONS)[number]["fields"][number]["key"];

function ClientSettingsTab({ client }: { client: ClientRow }) {
  const router = useRouter();
  const initial: Record<SettingsKey, string> = {
    website:            client.website ?? "",
    sc_url:             client.sc_url ?? "",
    ga4_property_id:    client.ga4_property_id ?? "",
    gtm_container_id:   client.gtm_container_id ?? "",
    google_place_id:    client.google_place_id ?? "",
    ads_customer_id:    client.ads_customer_id ?? "",
    basecamp_project_id: client.basecamp_project_id ?? "",
    harvest_project_id:  client.harvest_project_id ?? "",
    harvest_client_id:   client.harvest_client_id ?? "",
    shared_drive_url:    client.shared_drive_url ?? "",
    contact_name:        client.contact_name ?? "",
    contact_email:       client.contact_email ?? "",
  };
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function set(key: SettingsKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Save failed");
      setSavedAt(Date.now());
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {SETTINGS_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {section.label}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.fields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
                <input
                  type="text"
                  value={values[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder-neutral-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt && !saveError && (
          <span className="text-xs text-emerald-600 font-medium">Saved</span>
        )}
        {saveError && (
          <span className="text-xs text-red-600">{saveError}</span>
        )}
      </div>
    </div>
  );
}

// ── Service Playbook tab ──────────────────────────────────────────────────────
const CATEGORY_ORDER = ["Initial Setup", "Monthly Work", "Monthly Communications", "Guidelines"];

function PlatformCheckRow({ check }: { check: PlatformCheck }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-50">
      {check.pass ? (
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-2.5 w-2.5 text-emerald-600" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5"/>
          </svg>
        </span>
      ) : (
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100">
          <svg className="h-2.5 w-2.5 text-red-500" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 3l6 6M9 3l-6 6"/>
          </svg>
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${check.pass ? "text-neutral-700" : "text-red-700"}`}>
          {check.label}
        </p>
        <p className={`text-xs leading-snug mt-0.5 ${check.pass ? "text-neutral-400" : "text-red-500"}`}>
          {check.detail}
        </p>
      </div>
    </div>
  );
}

function ServicePlaybookTab({
  items,
  client,
  tierKey,
  workspace,
}: {
  items: PlaybookItem[];
  client: ClientRow;
  tierKey: string;
  workspace?: ClientWorkspaceInitialData | null;
}) {
  const platformChecks = tierKey.startsWith("seo-") && workspace
    ? runSeoPlatformChecks(workspace)
    : null;

  const byCategory = new Map<string, PlaybookItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }
  const categories = [...byCategory.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  if (!platformChecks && items.length === 0) {
    return <p className="text-xs text-neutral-400">No playbook items for this service tier.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Platform connection checks — SEO only */}
      {platformChecks && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Platform Status</p>
          <div className="space-y-0.5">
            {platformChecks.map((check) => (
              <PlatformCheckRow key={check.key} check={check} />
            ))}
          </div>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{cat}</p>
          <div className="space-y-0.5">
            {byCategory.get(cat)!.map((item) => {
              const verifyResult = item.auto_verify_key
                ? runVerifications([item.auto_verify_key], client)[0] ?? null
                : null;
              const pass = verifyResult?.pass ?? null;

              return (
                <div key={item.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                  {/* Status indicator */}
                  {pass === true ? (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <svg className="h-2.5 w-2.5 text-emerald-600" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5"/>
                      </svg>
                    </span>
                  ) : pass === false ? (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-2.5 w-2.5 text-red-500" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M3 3l6 6M9 3l-6 6"/>
                      </svg>
                    </span>
                  ) : item.type === "guideline" ? (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-200" />
                  ) : item.type === "deliverable" ? (
                    <span className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300">
                      <svg fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5"><path d="M4 2h6l3 3v9H4V2z"/><path d="M10 2v3h3"/></svg>
                    </span>
                  ) : (
                    <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-neutral-300" />
                  )}

                  <p className={`flex-1 text-sm leading-snug ${
                    pass === false ? "text-red-700 font-medium" :
                    pass === true  ? "text-neutral-500 line-through" :
                    item.type === "guideline" ? "text-neutral-400 italic" :
                    "text-neutral-700"
                  }`}>
                    {item.title}
                  </p>

                  {item.auto_verify_key && (
                    <span className="mt-0.5 shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">
                      auto
                    </span>
                  )}
                  {item.type === "deliverable" && !item.auto_verify_key && (
                    <span className="mt-0.5 shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-500">
                      deliverable
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SEO Audit section ─────────────────────────────────────────────────────────
function formatAuditDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function seoMailto(to: string, clientName: string, appUrl: string, status: string) {
  const subject = `SEO audit ${status} — ${clientName}`;
  const body = [
    "Hi,",
    "",
    `The recurring SEO site audit for ${clientName} is ${status}.`,
    "",
    `Run it here: ${appUrl.replace(/\/$/, "")}/seo-audits`,
    "",
    "Sent from BIP Control Panel",
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function SeoAuditSection({
  schedule,
  roster,
  appUrl,
  onRunAudit,
  isRunning,
  auditProgress,
  auditError,
  cadenceDraft,
  onCadenceChange,
  onSaveSchedule,
  isSavingSchedule,
  scheduleError,
  pastAudits,
  onOpenAudit,
}: {
  schedule: ClientSeoAuditScheduleWithClient | null;
  roster: StrategistContact[];
  appUrl: string;
  onRunAudit: () => void;
  isRunning: boolean;
  auditProgress: string | null;
  auditError: string | null;
  cadenceDraft: 3 | 6;
  onCadenceChange: (v: 3 | 6) => void;
  onSaveSchedule: () => void;
  isSavingSchedule: boolean;
  scheduleError: string | null;
  pastAudits: ClientSeoAudit[];
  onOpenAudit: (audit: ClientSeoAudit) => void;
}) {
  const hasSchedule = !!schedule;
  const status = schedule ? dueStatus(schedule.next_due_at) : "none";
  const strategist = schedule ? matchStrategistByName(schedule.marketing_strategist, roster) : null;
  const cadenceChanged = hasSchedule && cadenceDraft !== schedule!.cadence_months;

  const statusConfig = {
    overdue: { label: "Overdue", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", card: "border-red-200 bg-red-50" },
    due:     { label: "Due soon", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400", card: "border-amber-200 bg-amber-50" },
    upcoming:{ label: "Upcoming", bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400", card: "border-neutral-200 bg-white" },
    none:    { label: "Not scheduled", bg: "bg-neutral-100", text: "text-neutral-500", dot: "bg-neutral-300", card: "border-neutral-200 bg-white" },
  }[status];

  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        SEO Audit
      </h2>
      <div className={`rounded-xl border p-5 ${statusConfig.card}`}>

        {/* ── Top row: status + dates + run button ── */}
        <div className="flex flex-wrap items-center gap-4">

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusConfig.dot}`} />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Date info (only when enrolled) */}
          {hasSchedule && (
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Last completed</p>
                <p className="mt-0.5 text-sm font-medium text-neutral-700">
                  {formatAuditDate(schedule!.last_completed_at)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Next due</p>
                <p className={`mt-0.5 text-sm font-medium ${status === "overdue" ? "text-red-700" : status === "due" ? "text-amber-700" : "text-neutral-700"}`}>
                  {formatAuditDate(schedule!.next_due_at)}
                </p>
              </div>
            </div>
          )}

          {/* Run + notify actions */}
          <div className="ml-auto flex items-center gap-2">
            {hasSchedule && strategist?.email && (
              <a
                href={seoMailto(strategist.email, schedule!.account_name, appUrl, statusConfig.label.toLowerCase())}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:border-neutral-400 hover:text-neutral-800 transition-colors"
              >
                <Bell size={12} /> Notify
              </a>
            )}
            <button
              type="button"
              onClick={onRunAudit}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {isRunning ? "Running…" : "Run Audit"}
            </button>
          </div>
        </div>

        {/* ── Schedule row ── */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 shrink-0">
            Recurring schedule
          </p>
          <select
            value={cadenceDraft}
            onChange={(e) => onCadenceChange(Number(e.target.value) as 3 | 6)}
            disabled={isSavingSchedule}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 shadow-sm focus:border-indigo-400 focus:outline-none disabled:opacity-60"
          >
            <option value={3}>Every 3 months</option>
            <option value={6}>Every 6 months</option>
          </select>
          {(!hasSchedule || cadenceChanged) && (
            <button
              type="button"
              onClick={onSaveSchedule}
              disabled={isSavingSchedule}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSavingSchedule ? <Loader2 size={12} className="animate-spin" /> : null}
              {hasSchedule ? "Update schedule" : "Enroll client"}
            </button>
          )}
          {hasSchedule && !cadenceChanged && (
            <span className="text-xs text-neutral-400">
              Next audit due {formatAuditDate(schedule!.next_due_at)}
            </span>
          )}
        </div>

        {/* Progress */}
        {isRunning && auditProgress && (
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 size={12} className="animate-spin shrink-0" />
            <span>{auditProgress}</span>
          </div>
        )}

        {/* Errors */}
        {auditError && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {auditError}
          </div>
        )}
        {scheduleError && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {scheduleError}
          </div>
        )}

        {/* ── Past audits ── */}
        {pastAudits.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Saved audits
            </p>
            <ul className="divide-y divide-neutral-100">
              {pastAudits.map((audit) => (
                <li key={audit.id} className="flex items-center gap-3 py-2">
                  <FileText size={13} className="shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-700">
                      {new Date(audit.audit_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                    <p className="text-[11px] text-neutral-400 capitalize">{audit.status.replace("_", " ")}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    audit.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : audit.status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-neutral-100 text-neutral-500"
                  }`}>
                    {audit.status === "in_progress" ? "In progress" : audit.status === "draft" ? "Draft" : "Completed"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAudit(audit)}
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm hover:border-neutral-400 hover:text-neutral-800 transition-colors"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CockpitSandbox({
  clients,
  selectedId,
  workspace,
  playbookItems = [],
  seoSchedule = null,
  pastAudits: initialPastAudits = [],
  roster = [],
  appUrl = "",
}: {
  clients: ClientStub[];
  selectedId: number | null;
  workspace: ClientWorkspaceInitialData | null;
  playbookItems?: PlaybookItem[];
  seoSchedule?: ClientSeoAuditScheduleWithClient | null;
  pastAudits?: ClientSeoAudit[];
  roster?: StrategistContact[];
  appUrl?: string;
}) {
  const router = useRouter();
  const [auditProgress, setAuditProgress] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditDraft, setAuditDraft] = useState<ClientSeoAudit | null>(null);

  // Past audits state — prepended when new runs complete
  const [pastAudits, setPastAudits] = useState<ClientSeoAudit[]>(initialPastAudits);

  const [activeServiceTab, setActiveServiceTab] = useState<string | null>(null);

  // Schedule state — held locally so saves reflect immediately without reload
  const [localSchedule, setLocalSchedule] = useState<ClientSeoAuditScheduleWithClient | null>(seoSchedule);
  const [cadenceDraft, setCadenceDraft] = useState<3 | 6>(seoSchedule?.cadence_months ?? 6);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setAuditDraft(null);
    setAuditError(null);
    router.push(val ? `/dashboard/cockpit?client=${val}` : "/dashboard/cockpit");
  }

  async function handleSaveSchedule() {
    if (!client) return;
    setIsSavingSchedule(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/client-seo-audits/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, cadenceMonths: cadenceDraft }),
      });
      const payload = (await res.json()) as { error?: string; schedules?: ClientSeoAuditScheduleWithClient[] };
      if (!res.ok || !payload.schedules) throw new Error(payload.error ?? "Failed to save schedule");
      const updated = payload.schedules.find((s) => s.client_id === client.id) ?? null;
      setLocalSchedule(updated);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : "Failed to save schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function handleRunAudit() {
    if (!client) return;
    const clientId = client.id;
    const clientName = client.account_name;
    setAuditError(null);
    setAuditProgress(`Starting audit for ${clientName}…`);
    try {
      const createRes = await fetch("/api/client-seo-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const created = (await createRes.json()) as { error?: string; audit?: ClientSeoAudit; run?: WebsiteAuditRun };
      if (!createRes.ok || !created.audit || !created.run) throw new Error(created.error ?? "Failed to start audit");
      const runId = created.run.id;

      for (const stage of AUDIT_STAGES) {
        setAuditProgress(`Running ${stage.replace(/_/g, " ")}…`);
        const stageRes = await fetch(`/api/site-audit/runs/${runId}/stages/${stage}`, { method: "POST" });
        const stagePayload = (await stageRes.json()) as { error?: string; run?: WebsiteAuditRun };
        if (!stageRes.ok || !stagePayload.run) throw new Error(stagePayload.error ?? `Stage ${stage} failed`);
      }

      setAuditProgress("Building the draft from results…");
      const buildRes = await fetch(`/api/client-seo-audits/${created.audit.id}/build`, { method: "POST" });
      const built = (await buildRes.json()) as { error?: string; audit?: ClientSeoAudit };
      if (!buildRes.ok || !built.audit) throw new Error(built.error ?? "Failed to build draft");

      setAuditDraft(built.audit);
      setPastAudits((prev) => [built.audit!, ...prev.filter((a) => a.id !== built.audit!.id)]);
      setAuditProgress(null);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Audit failed");
      setAuditProgress(null);
    }
  }

  const cockpit = workspace ? toCockpitViewModel(workspace) : null;
  const client = workspace?.client ?? null;
  const p1Items = cockpit?.focus.filter((f) => f.priority === "P1") ?? [];
  const p2Items = cockpit?.focus.filter((f) => f.priority === "P2") ?? [];
  const wins = cockpit?.features.filter((f) => !f.title.startsWith("No clean wins")) ?? [];

  const services = client ? activeServiceLabels(getClientActiveServices(client)) : [];
  const serviceTiers = client
    ? [
        { label: "SEO", value: client.seo },
        { label: "PPC", value: client.ppc },
        { label: "Social", value: client.smm },
        { label: "Blog", value: client.blog },
        { label: "ORM", value: client.orm },
      ].filter(({ value }) => isServiceActive(value))
    : [];

  const serviceTabs = client ? getClientServiceTierDefs(client) : [];
  const SETTINGS_TAB = "__settings";
  const activeTab = activeServiceTab === SETTINGS_TAB
    ? SETTINGS_TAB
    : (serviceTabs.find((t) => t.tierKey === activeServiceTab)?.tierKey
      ?? serviceTabs[0]?.tierKey
      ?? null);
  const pkgHours = client?.total_package_hours ?? 0;
  const stratHours = client?.hours_for_strategist ?? 0;
  const hoursPercent = pkgHours > 0 ? Math.min(100, (stratHours / pkgHours) * 100) : 0;

  const threads = workspace ? groupIntoThreads(workspace.threadEvents) : [];

  return (
    <div
      data-theme="light"
      className="flex flex-1 flex-col min-h-screen bg-neutral-50 font-sans"
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">
            Cockpit sandbox
          </p>
          <p className="text-xs text-neutral-400">
            Internal only · not deployed yet
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {client && (
            <Link
              href={`/reports/${client.id}?back=cockpit`}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-600 shadow-sm hover:border-neutral-400 hover:text-neutral-800 transition-colors"
            >
              <BarChart2 size={14} /> Reporting
            </Link>
          )}
          <select
            value={selectedId ?? ""}
            onChange={handleSelect}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-indigo-500 focus:outline-none min-w-[280px]"
          >
            <option value="">— Select a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.account_name}
                {c.marketing_strategist ? ` · ${c.marketing_strategist}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!workspace || !client || !cockpit ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">
            Select a client above to load the cockpit.
          </p>
        </div>
      ) : (
        <div className="p-6 space-y-5">

          {/* ── Header info ───────────────────────────────────────── */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-neutral-900">{client.account_name}</h1>
                <p className="mt-0.5 text-sm text-neutral-400">
                  #{client.id}
                  {norm(client.marketing_strategist) ? ` · ${client.marketing_strategist}` : ""}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Status</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                {norm(client.tier) && (
                  <p className="mt-1.5 text-[11px] text-neutral-400">{client.tier}</p>
                )}
                {serviceTiers.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {serviceTiers.map(({ label, value }) => (
                      <span key={label} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                        {label} · {norm(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {pkgHours > 0 && (
                <div className="min-w-[160px]">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Monthly hours</p>
                  <p className="text-sm font-semibold text-neutral-800">{stratHours} / {pkgHours} hrs</p>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-200">
                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${hoursPercent}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400">{Math.round(hoursPercent)}% used</p>
                </div>
              )}

              {(client.contact_name ?? client.contact_email) && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Contact</p>
                  <p className="text-sm font-medium text-neutral-800">{client.contact_name ?? "—"}</p>
                  {client.contact_email && (
                    <p className="text-xs text-neutral-500">{client.contact_email}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Connections ────────────────────────────────────────── */}
            {(() => {
              const checks = [
                { label: "GSC",       pass: Boolean(client.sc_url) },
                { label: "GA4",       pass: Boolean(client.ga4_property_id) },
                { label: "GBP",       pass: Boolean(client.google_place_id) },
                { label: "Basecamp",  pass: Boolean(client.basecamp_project_id) },
                { label: "Harvest",   pass: Boolean(client.harvest_project_id) },
                ...(client.ppc ? [{ label: "Ads", pass: Boolean(client.ads_customer_id) }] : []),
              ];
              const missing = checks.filter((c) => !c.pass);
              return (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mr-1">
                      Connections
                    </p>
                    {checks.map(({ label, pass }) => (
                      <span
                        key={label}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          pass
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${pass ? "bg-emerald-500" : "bg-red-400"}`} />
                        {label}
                      </span>
                    ))}
                    {missing.length === 0 && (
                      <span className="ml-1 text-[11px] text-emerald-600 font-medium">All connected</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Command Center ────────────────────────────────────── */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Command Center
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border-l-4 p-4 ${p1Items.length > 0 ? "border-red-500 bg-red-50" : "border-neutral-200 bg-white"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p1Items.length > 0 ? "bg-red-500" : "bg-neutral-300"}`} />
                  <span className={`text-sm font-semibold ${p1Items.length > 0 ? "text-red-700" : "text-neutral-400"}`}>
                    Critical: {p1Items.length}
                  </span>
                </div>
                {p1Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No critical issues</p>
                ) : (
                  <>
                    {p1Items.slice(0, 3).map((item, i) => (
                      <p key={i} className="mt-1 text-xs leading-snug text-red-700">{item.title}</p>
                    ))}
                    {p1Items.length > 3 && (
                      <p className="mt-1 text-[11px] text-red-400">+{p1Items.length - 3} more</p>
                    )}
                  </>
                )}
              </div>

              <div className={`rounded-xl border-l-4 p-4 ${p2Items.length > 0 ? "border-amber-400 bg-amber-50" : "border-neutral-200 bg-white"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p2Items.length > 0 ? "bg-amber-400" : "bg-neutral-300"}`} />
                  <span className={`text-sm font-semibold ${p2Items.length > 0 ? "text-amber-700" : "text-neutral-400"}`}>
                    Warning: {p2Items.length}
                  </span>
                </div>
                {p2Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No warnings</p>
                ) : (
                  <>
                    {p2Items.slice(0, 3).map((item, i) => (
                      <p key={i} className="mt-1 text-xs leading-snug text-amber-700">{item.title}</p>
                    ))}
                    {p2Items.length > 3 && (
                      <p className="mt-1 text-[11px] text-amber-500">+{p2Items.length - 3} more</p>
                    )}
                  </>
                )}
              </div>

              <div className={`rounded-xl border-l-4 p-4 ${wins.length > 0 ? "border-emerald-500 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${wins.length > 0 ? "bg-emerald-500" : "bg-neutral-300"}`} />
                  <span className={`text-sm font-semibold ${wins.length > 0 ? "text-emerald-700" : "text-neutral-400"}`}>
                    Good: {wins.length}
                  </span>
                </div>
                {wins.length === 0 ? (
                  <p className="text-xs text-neutral-400">Address critical items first</p>
                ) : (
                  wins.slice(0, 3).map((win, i) => (
                    <p key={i} className="mt-1 text-xs leading-snug text-emerald-700">{win.title}</p>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Services ─────────────────────────────────────────── */}
          {serviceTabs.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Services
              </h2>
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-neutral-100">
                  <div className="flex overflow-x-auto flex-1">
                    {serviceTabs.map((tab) => (
                      <button
                        key={tab.tierKey}
                        type="button"
                        onClick={() => setActiveServiceTab(tab.tierKey)}
                        className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === tab.tierKey
                            ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
                            : "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {tab.label}
                        {tab.tierLabel && (
                          <span className={`ml-1.5 font-normal ${
                            activeTab === tab.tierKey ? "text-indigo-400" : "text-neutral-400"
                          }`}>
                            {tab.tierLabel}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveServiceTab(SETTINGS_TAB)}
                    className={`shrink-0 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 border-l border-l-neutral-100 transition-colors ${
                      activeTab === SETTINGS_TAB
                        ? "border-b-neutral-400 text-neutral-700 bg-neutral-50"
                        : "border-b-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    Settings
                  </button>
                </div>
                {/* Tab content */}
                <div className="p-5">
                  {activeTab === SETTINGS_TAB ? (
                    <ClientSettingsTab key={client!.id} client={client!} />
                  ) : activeTab ? (
                    <ServicePlaybookTab
                      key={activeTab}
                      tierKey={activeTab}
                      items={playbookItems.filter((i) => i.tier_key === activeTab)}
                      client={client!}
                      workspace={workspace}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ── SEO Audit ────────────────────────────────────────── */}
          <SeoAuditSection
            schedule={localSchedule}
            roster={roster}
            appUrl={appUrl}
            onRunAudit={handleRunAudit}
            isRunning={auditProgress !== null}
            auditProgress={auditProgress}
            auditError={auditError}
            cadenceDraft={cadenceDraft}
            onCadenceChange={setCadenceDraft}
            onSaveSchedule={handleSaveSchedule}
            isSavingSchedule={isSavingSchedule}
            scheduleError={scheduleError}
            pastAudits={pastAudits}
            onOpenAudit={setAuditDraft}
          />

          {/* ── Recent Activity ───────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Recent Activity
              </h2>
              <span className="text-[11px] text-neutral-300">Last 30 days · Basecamp</span>
            </div>

            {threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
                No Basecamp activity in the last 30 days.
              </div>
            ) : (
              <div className="space-y-3">
                {threads.map((thread) => {
                  const bcUrl = openableBasecampUrl(thread.url);
                  return (
                    <div
                      key={thread.threadId}
                      className={`overflow-hidden rounded-xl border bg-white ${
                        thread.hasFlagged ? "border-red-200" : "border-neutral-200"
                      }`}
                    >
                      {/* Thread header */}
                      <div
                        className={`flex items-center justify-between gap-3 px-4 py-3 ${
                          thread.hasFlagged
                            ? "bg-red-50 border-b border-red-100"
                            : "bg-neutral-50 border-b border-neutral-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {thread.hasFlagged && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                          )}
                          <span className="truncate text-sm font-semibold text-neutral-800">
                            {thread.title ?? "Untitled thread"}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-[11px] text-neutral-400">
                            {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""}
                          </span>
                          {bcUrl && (
                            <a
                              href={bcUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
                            >
                              Basecamp <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Messages */}
                      <ul className="divide-y divide-neutral-100">
                        {thread.messages.map((msg) => {
                          const flagged = isFlagged(msg);
                          return (
                            <li
                              key={msg.id}
                              className={`flex gap-3 px-4 py-3 ${
                                flagged ? "border-l-4 border-red-400 bg-red-50/60" : ""
                              }`}
                            >
                              {/* Avatar */}
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  flagged
                                    ? "bg-red-100 text-red-700"
                                    : "bg-indigo-50 text-indigo-600"
                                }`}
                              >
                                {avatarInitial(msg.author_email)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-neutral-700">
                                    {authorLabel(msg.author_email)}
                                  </span>
                                  {!msg.is_internal && (
                                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                      Client
                                    </span>
                                  )}
                                  {msg.is_internal &&
                                    FLAG_NAMES.some((n) =>
                                      (msg.author_email ?? "").toLowerCase().includes(n),
                                    ) && (
                                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                        Flagged
                                      </span>
                                    )}
                                  <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
                                    {formatRelative(msg.occurred_at)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                                  {previewText(msg, 300)}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Audit editor overlay ─────────────────────────────── */}
      {auditDraft && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bip-page)]">
          <div className="flex items-center justify-between border-b border-[var(--bip-border)] bg-[var(--bip-card)] px-6 py-4">
            <div>
              <h1 className="text-base font-semibold text-[var(--text)]">
                {auditDraft.template_json.meta.client || "SEO Audit"}
              </h1>
              <p className="text-xs text-[var(--text-muted)]">SEO Site Audit · Draft</p>
            </div>
            <button
              type="button"
              onClick={() => setAuditDraft(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--bip-border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bip-hover)] transition-colors"
            >
              <ArrowLeft size={15} /> Back to cockpit
            </button>
          </div>
          <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-6">
            <SeoAuditEditor
              audit={auditDraft}
              onSaved={(updated) => {
                setAuditDraft(updated);
                setPastAudits((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
