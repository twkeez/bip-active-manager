"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import {
  ILLUMINARE_CLIENT_STATUSES,
  ILLUMINARE_ENGAGEMENT_TYPES,
  type IlluminareClientRow,
  type IlluminareClientStatus,
  type IlluminareEngagementType,
} from "@/lib/illuminare/types";

const ENGAGEMENT_LABELS: Record<IlluminareEngagementType, string> = {
  retainer: "Retainer",
  project: "One-time project",
  hybrid: "Hybrid",
};

type FormState = {
  accountLead: string;
  status: IlluminareClientStatus;
  website: string;
  contactName: string;
  contactEmail: string;
  engagementType: IlluminareEngagementType | "";
  scopeSummary: string;
  retainerNotes: string;
  goals: string;
  strategy: string;
  progressNotes: string;
};

function toForm(client: IlluminareClientRow): FormState {
  return {
    accountLead: client.account_lead ?? "",
    status: client.status,
    website: client.website ?? "",
    contactName: client.contact_name ?? "",
    contactEmail: client.contact_email ?? "",
    engagementType: client.engagement_type ?? "",
    scopeSummary: client.scope_summary ?? "",
    retainerNotes: client.retainer_notes ?? "",
    goals: client.goals ?? "",
    strategy: client.strategy ?? "",
    progressNotes: client.progress_notes ?? "",
  };
}

export default function IlluminareClientPlan({
  client,
}: {
  client: IlluminareClientRow;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(client));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit() {
    setForm(toForm(client));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/illuminare/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountLead: form.accountLead,
          status: form.status,
          website: form.website,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          engagementType: form.engagementType || null,
          scopeSummary: form.scopeSummary,
          retainerNotes: form.retainerNotes,
          goals: form.goals,
          strategy: form.strategy,
          progressNotes: form.progressNotes,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Account plan & strategy
          </h2>
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--bip-border)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bip-hover)]"
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-[var(--bip-accent)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--bip-border)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--bip-hover)]"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        {editing ? (
          <EditForm form={form} set={set} />
        ) : (
          <ReadView client={client} />
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </p>
      {value ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{value}</p>
      ) : (
        <p className="mt-1 text-sm text-[var(--text-subtle)]">—</p>
      )}
    </div>
  );
}

function ReadView({ client }: { client: IlluminareClientRow }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Lead" value={client.account_lead} />
        <Field
          label="Engagement"
          value={
            client.engagement_type
              ? ENGAGEMENT_LABELS[client.engagement_type]
              : null
          }
        />
        <Field
          label="Contact"
          value={
            [client.contact_name, client.contact_email]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
      </div>
      <div className="border-t border-[var(--bip-border)]" />
      <Field label="Scope — what we're doing" value={client.scope_summary} />
      <Field label="Retainer / budget" value={client.retainer_notes} />
      <div className="border-t border-[var(--bip-border)]" />
      <Field label="Client goals" value={client.goals} />
      <Field label="Our strategy" value={client.strategy} />
      <Field label="Progress notes" value={client.progress_notes} />
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--bip-border)] bg-[var(--bip-bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--bip-accent)] focus:outline-none";

function Label({
  children,
  htmlText,
}: {
  children: React.ReactNode;
  htmlText: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
      {htmlText}
      {children}
    </label>
  );
}

function EditForm({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Label htmlText="Lead">
          <input
            className={inputCls}
            value={form.accountLead}
            onChange={(e) => set("accountLead", e.target.value)}
          />
        </Label>
        <Label htmlText="Status">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) =>
              set("status", e.target.value as IlluminareClientStatus)
            }
          >
            {ILLUMINARE_CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Label>
        <Label htmlText="Engagement">
          <select
            className={inputCls}
            value={form.engagementType}
            onChange={(e) =>
              set(
                "engagementType",
                e.target.value as IlluminareEngagementType | "",
              )
            }
          >
            <option value="">—</option>
            {ILLUMINARE_ENGAGEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENGAGEMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label htmlText="Website">
          <input
            className={inputCls}
            placeholder="https://"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </Label>
        <Label htmlText="Contact name">
          <input
            className={inputCls}
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </Label>
        <Label htmlText="Contact email">
          <input
            className={inputCls}
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </Label>
      </div>

      <Label htmlText="Scope — what we're doing">
        <textarea
          className={inputCls}
          rows={2}
          value={form.scopeSummary}
          onChange={(e) => set("scopeSummary", e.target.value)}
        />
      </Label>
      <Label htmlText="Retainer / budget">
        <textarea
          className={inputCls}
          rows={2}
          value={form.retainerNotes}
          onChange={(e) => set("retainerNotes", e.target.value)}
        />
      </Label>
      <Label htmlText="Client goals">
        <textarea
          className={inputCls}
          rows={2}
          value={form.goals}
          onChange={(e) => set("goals", e.target.value)}
        />
      </Label>
      <Label htmlText="Our strategy">
        <textarea
          className={inputCls}
          rows={2}
          value={form.strategy}
          onChange={(e) => set("strategy", e.target.value)}
        />
      </Label>
      <Label htmlText="Progress notes">
        <textarea
          className={inputCls}
          rows={3}
          value={form.progressNotes}
          onChange={(e) => set("progressNotes", e.target.value)}
        />
      </Label>
    </div>
  );
}
