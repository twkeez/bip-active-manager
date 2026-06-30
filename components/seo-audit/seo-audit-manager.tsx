"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Bell, FileText, Loader2, Play } from "lucide-react";
import SeoAuditEditor from "@/components/seo-audit/seo-audit-editor";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";
import { dueStatus, type CadenceMonths } from "@/lib/site-audit/seo-audit-schedule";
import { matchStrategistByName, type StrategistContact } from "@/lib/team/strategist-roster";
import type {
  ClientSeoAudit,
  ClientSeoAuditScheduleWithClient,
  ClientSeoAuditWithClient,
} from "@/lib/site-audit/seo-audit-types";

type ClientOption = { id: number; account_name: string; website: string | null; marketing_strategist: string | null };

type Props = {
  clients: ClientOption[];
  initialSchedules: ClientSeoAuditScheduleWithClient[];
  initialAudits: ClientSeoAuditWithClient[];
  roster: StrategistContact[];
  userEmail: string | undefined;
  appUrl: string;
};

const STATUS_CHIP: Record<string, string> = {
  overdue: "border-red-500/40 bg-red-500/10 text-red-300",
  due: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  upcoming: "border-bip-border bg-bip-fill text-bip-muted",
  none: "border-bip-border bg-bip-fill text-bip-muted",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildAuditDueMailto(to: string, clientName: string, appUrl: string, status: string) {
  const subject = `SEO audit ${status} — ${clientName}`;
  const body = [
    "Hi,",
    "",
    `The recurring SEO site audit for ${clientName} is ${status}.`,
    "",
    `Open the SEO Audits tool to run it: ${appUrl.replace(/\/$/, "")}/seo-audits`,
    "",
    "Sent from BIP Control Panel",
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function SeoAuditManager({ clients, initialSchedules, initialAudits, roster, userEmail, appUrl }: Props) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [audits, setAudits] = useState(initialAudits);
  const [editing, setEditing] = useState<ClientSeoAudit | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busyClientId, setBusyClientId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enrollClientId, setEnrollClientId] = useState("");
  const [enrollCadence, setEnrollCadence] = useState<CadenceMonths>(6);

  const enrolledIds = useMemo(() => new Set(schedules.map((s) => s.client_id)), [schedules]);
  const unenrolled = useMemo(() => clients.filter((c) => !enrolledIds.has(c.id)), [clients, enrolledIds]);

  async function upsertSchedule(clientId: number, cadenceMonths: CadenceMonths, isActive = true) {
    const response = await fetch("/api/client-seo-audits/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, cadenceMonths, isActive }),
    });
    const payload = (await response.json()) as { error?: string; schedules?: ClientSeoAuditScheduleWithClient[] };
    if (!response.ok || !payload.schedules) throw new Error(payload.error ?? "Failed to save schedule");
    setSchedules(payload.schedules);
  }

  async function handleEnroll() {
    const clientId = Number(enrollClientId);
    if (!clientId) return;
    setError(null);
    try {
      await upsertSchedule(clientId, enrollCadence);
      setEnrollClientId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enroll client");
    }
  }

  async function handleStartAudit(clientId: number, clientName: string) {
    setBusyClientId(clientId);
    setError(null);
    setProgress(`Starting audit for ${clientName}…`);
    try {
      // 1. Create the run + audit instance.
      const createRes = await fetch("/api/client-seo-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const created = (await createRes.json()) as { error?: string; audit?: ClientSeoAuditWithClient; run?: WebsiteAuditRun };
      if (!createRes.ok || !created.audit || !created.run) throw new Error(created.error ?? "Failed to start audit");
      const runId = created.run.id;

      // 2. Drive the engine stages (mirrors the website-rebuild Site Audit flow).
      for (const stage of AUDIT_STAGES) {
        setProgress(`Running ${stage.replace(/_/g, " ")}…`);
        const stageRes = await fetch(`/api/site-audit/runs/${runId}/stages/${stage}`, { method: "POST" });
        const stagePayload = (await stageRes.json()) as { error?: string; run?: WebsiteAuditRun };
        if (!stageRes.ok || !stagePayload.run) throw new Error(stagePayload.error ?? `Stage ${stage} failed`);
        // A failed stage doesn't abort — partial data still produces a useful draft.
      }

      // 3. Map results + AI-draft the prose.
      setProgress("Building the draft from results…");
      const buildRes = await fetch(`/api/client-seo-audits/${created.audit.id}/build`, { method: "POST" });
      const built = (await buildRes.json()) as { error?: string; audit?: ClientSeoAudit };
      if (!buildRes.ok || !built.audit) throw new Error(built.error ?? "Failed to build draft");

      setAudits((prev) => [{ ...built.audit!, account_name: clientName }, ...prev.filter((a) => a.id !== built.audit!.id)]);
      setEditing(built.audit);
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run audit");
      setProgress(null);
    } finally {
      setBusyClientId(null);
    }
  }

  function handleSavedFromEditor(updated: ClientSeoAudit) {
    setEditing(updated);
    setAudits((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    // A completion may have advanced the schedule — refresh it lazily.
    if (updated.status === "completed") {
      void fetch("/api/client-seo-audits/schedules", { cache: "no-store" })
        .then((r) => r.json())
        .then((p: { schedules?: ClientSeoAuditScheduleWithClient[] }) => p.schedules && setSchedules(p.schedules))
        .catch(() => {});
    }
  }

  if (editing) {
    return (
      <div className="flex min-h-screen flex-col bg-bip-page">
        <header className="border-b border-bip-border bg-bip-card px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-bip-text">{editing.template_json.meta.client || "SEO Audit"}</h1>
              <p className="text-xs text-bip-muted">SEO Site Audit · {editing.status}</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text hover:bg-bip-fill">
              <ArrowLeft className="h-4 w-4" /> Back to audits
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 p-6">
          <SeoAuditEditor audit={editing} onSaved={handleSavedFromEditor} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      <header className="border-b border-bip-border bg-bip-card px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-bip-text">SEO Audits</h1>
            <p className="text-xs text-bip-muted">{userEmail ?? "Signed in"}</p>
          </div>
          <a href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text hover:bg-bip-fill">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
        {progress && (
          <div className="flex items-center gap-2 rounded-lg border border-bip-accent/30 bg-bip-accent/5 px-3 py-2 text-sm text-bip-text">
            <Loader2 className="h-4 w-4 animate-spin" /> {progress}
          </div>
        )}
        {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

        {/* Schedule / due overview */}
        <section className="rounded-xl border border-bip-border bg-bip-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-bip-muted">Audit schedule</p>
          {schedules.length === 0 ? (
            <p className="text-sm text-bip-muted">No clients enrolled yet. Add one below.</p>
          ) : (
            <ul className="divide-y divide-bip-border">
              {schedules.map((schedule) => {
                const status = dueStatus(schedule.next_due_at);
                const strategist = matchStrategistByName(schedule.marketing_strategist, roster);
                const busy = busyClientId === schedule.client_id;
                return (
                  <li key={schedule.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-bip-text">{schedule.account_name}</p>
                      <p className="text-xs text-bip-muted">
                        Every {schedule.cadence_months} mo · next due {formatDate(schedule.next_due_at)}
                        {schedule.marketing_strategist ? ` · ${schedule.marketing_strategist}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${STATUS_CHIP[status]}`}>{status}</span>
                    <select
                      value={schedule.cadence_months}
                      onChange={(e) => void upsertSchedule(schedule.client_id, Number(e.target.value) as CadenceMonths).catch((err) => setError(err instanceof Error ? err.message : "Failed"))}
                      className="rounded-md border border-bip-border bg-bip-card px-2 py-1 text-xs text-bip-text"
                    >
                      <option value={3}>Every 3 mo</option>
                      <option value={6}>Every 6 mo</option>
                    </select>
                    {(status === "due" || status === "overdue") && strategist?.email && (
                      <a href={buildAuditDueMailto(strategist.email, schedule.account_name, appUrl, status)} className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill">
                        <Bell className="h-3 w-3" /> Notify
                      </a>
                    )}
                    <button type="button" disabled={busy} onClick={() => void handleStartAudit(schedule.client_id, schedule.account_name)} className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Start audit
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Enroll */}
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-bip-border pt-3">
            <label className="text-xs text-bip-muted">Enroll a client
              <select value={enrollClientId} onChange={(e) => setEnrollClientId(e.target.value)} className="mt-1 block rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text">
                <option value="">Select client…</option>
                {unenrolled.map((c) => <option key={c.id} value={c.id}>{c.account_name}</option>)}
              </select>
            </label>
            <select value={enrollCadence} onChange={(e) => setEnrollCadence(Number(e.target.value) as CadenceMonths)} className="rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text">
              <option value={3}>Every 3 mo</option>
              <option value={6}>Every 6 mo</option>
            </select>
            <button type="button" disabled={!enrollClientId} onClick={() => void handleEnroll()} className="rounded-md border border-bip-border bg-bip-card px-3 py-1.5 text-sm text-bip-text hover:bg-bip-fill disabled:opacity-50">Add</button>
          </div>
        </section>

        {/* Past audits */}
        <section className="rounded-xl border border-bip-border bg-bip-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-bip-muted">Audits</p>
          {audits.length === 0 ? (
            <p className="text-sm text-bip-muted">No audits yet. Start one from the schedule above.</p>
          ) : (
            <ul className="divide-y divide-bip-border">
              {audits.map((audit) => (
                <li key={audit.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-bip-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-bip-text">{audit.account_name}</p>
                    <p className="text-xs text-bip-muted">{formatDate(audit.audit_date)} · {audit.status}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(audit)} className="rounded-md border border-bip-border px-3 py-1 text-xs text-bip-text hover:bg-bip-fill">Open</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
