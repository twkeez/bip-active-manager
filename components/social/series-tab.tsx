"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Repeat, Trash2 } from "lucide-react";
import { CAMPAIGN_TYPES, getCampaignType } from "@/lib/social/campaign-types";
import { purposeStyle } from "@/lib/social/purpose-style";
import { SOCIAL_PURPOSES, type SocialPurpose, type SocialSeriesWithParts } from "@/lib/social/types";
import type { PlannerClient } from "./planner/planner-board";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const WEEKDAY_LABEL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PartDraft = { title: string; description: string; suggested_shot: string };

type FormState = {
  kind: "recurring" | "arc";
  title: string;
  description: string;
  campaign_type: string;
  purpose: string;
  tags: string;
  scope: "global" | "client";
  cadence: string;
  day_of_week: string;
  spacing_days: string;
  parts: PartDraft[];
};

const EMPTY_FORM: FormState = {
  kind: "recurring",
  title: "",
  description: "",
  campaign_type: "series",
  purpose: "",
  tags: "",
  scope: "global",
  cadence: "weekly",
  day_of_week: "5",
  spacing_days: "7",
  parts: [{ title: "", description: "", suggested_shot: "" }],
};

const inputClass =
  "w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";

export function SeriesTab({
  series: initialSeries,
  clients,
  selectedClientId,
  isAdminUser,
}: {
  series: SocialSeriesWithParts[];
  clients: PlannerClient[];
  selectedClientId?: number | null;
  isAdminUser: boolean;
}) {
  const [series, setSeries] = useState(initialSeries);
  const [kindFilter, setKindFilter] = useState<"all" | "recurring" | "arc">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.account_name]));
    return (id: number | null) => (id == null ? "All practices" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  const active = series.filter((s) => s.is_active && (kindFilter === "all" || s.kind === kindFilter));
  const archived = series.filter((s) => !s.is_active);

  const counts = {
    all: series.filter((s) => s.is_active).length,
    recurring: series.filter((s) => s.is_active && s.kind === "recurring").length,
    arc: series.filter((s) => s.is_active && s.kind === "arc").length,
  };

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(s: SocialSeriesWithParts) {
    setForm({
      kind: s.kind,
      title: s.title,
      description: s.description,
      campaign_type: s.campaign_type,
      purpose: s.purpose ?? "",
      tags: s.tags.join(", "),
      scope: s.client_id == null ? "global" : "client",
      cadence: s.cadence ?? "weekly",
      day_of_week: s.day_of_week == null ? "" : String(s.day_of_week),
      spacing_days: s.spacing_days == null ? "7" : String(s.spacing_days),
      parts:
        s.parts.length > 0
          ? [...s.parts]
              .sort((a, b) => a.part_number - b.part_number)
              .map((p) => ({ title: p.title, description: p.description, suggested_shot: p.suggested_shot ?? "" }))
          : [{ title: "", description: "", suggested_shot: "" }],
    });
    setEditingId(s.id);
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      kind: form.kind,
      title: form.title,
      description: form.description,
      campaign_type: form.campaign_type,
      purpose: form.purpose || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      client_id: form.scope === "client" ? selectedClientId ?? null : null,
      ...(form.kind === "recurring"
        ? { cadence: form.cadence, day_of_week: form.day_of_week === "" ? null : Number(form.day_of_week) }
        : { spacing_days: Number(form.spacing_days), parts: form.parts.filter((p) => p.title.trim()) }),
    };
    try {
      const res = await fetch(editingId ? `/api/social/series/${editingId}` : "/api/social/series", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as SocialSeriesWithParts & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSeries((prev) => (editingId ? prev.map((s) => (s.id === editingId ? data : s)) : [...prev, data]));
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: number) {
    await fetch(`/api/social/series/${id}`, { method: "DELETE" });
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: false } : s)));
  }

  async function restore(id: number) {
    await fetch(`/api/social/series/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: true } : s)));
  }

  // ── Part editing ───────────────────────────────────────────────────────────
  const setPart = (i: number, patch: Partial<PartDraft>) =>
    setForm((f) => ({ ...f, parts: f.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  const addPart = () =>
    setForm((f) => ({ ...f, parts: [...f.parts, { title: "", description: "", suggested_shot: "" }] }));
  const removePart = (i: number) =>
    setForm((f) => ({ ...f, parts: f.parts.filter((_, idx) => idx !== i) }));
  const movePart = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const next = [...f.parts];
      const j = i + dir;
      if (j < 0 || j >= next.length) return f;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...f, parts: next };
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Series</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Recurring slots that repeat on a cadence, and arcs that tell an ordered story in parts.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "recurring", "arc"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                kindFilter === k
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200/80 bg-white text-slate-500 shadow-sm hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {k === "all" ? "All" : k === "recurring" ? "Recurring" : "Arc"}
              <span className={`ml-1.5 tabular-nums ${kindFilter === k ? "opacity-60" : "text-slate-400"}`}>
                {counts[k]}
              </span>
            </button>
          ))}
          {isAdminUser && (
            <button
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
              className="ml-1 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-700"
            >
              {showForm ? "Cancel" : "+ New series"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold tracking-tight text-slate-900">
            {editingId ? "Edit series" : "New series"}
          </p>

          {/* Kind first — it decides which fields matter. */}
          <div className="mb-4">
            <span className={labelClass}>Kind</span>
            <div className="flex gap-2">
              {(["recurring", "arc"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setForm((f) => ({ ...f, kind: k }))}
                  disabled={Boolean(editingId)}
                  className={`flex flex-1 items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                    form.kind === k ? "border-slate-900 bg-slate-50" : "border-slate-200/80 hover:border-slate-400"
                  }`}
                >
                  {k === "arc" ? <Layers size={14} className="mt-0.5 text-slate-500" /> : <Repeat size={14} className="mt-0.5 text-slate-500" />}
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {k === "arc" ? "Arc" : "Recurring"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {k === "arc"
                        ? "An ordered run of parts, spaced out"
                        : "One slot that repeats on a cadence"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {editingId && (
              <p className="mt-1 text-xs text-slate-400">Kind can&rsquo;t change after creation.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Fun Fact Friday" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputClass} resize-y`} />
            </div>
            <div>
              <label className={labelClass}>Campaign type</label>
              <select value={form.campaign_type} onChange={(e) => setForm((f) => ({ ...f, campaign_type: e.target.value }))} className={inputClass}>
                {CAMPAIGN_TYPES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Purpose</label>
              <select value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className={inputClass}>
                <option value="">None</option>
                {SOCIAL_PURPOSES.map((p) => (
                  <option key={p} value={p}>{purposeStyle(p as SocialPurpose).label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tags (comma separated)</label>
              <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className={inputClass} placeholder="fun, engagement" />
            </div>
            <div>
              <label className={labelClass}>Availability</label>
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "global" | "client" }))}
                className={inputClass}
              >
                <option value="global">Global — every practice</option>
                <option value="client" disabled={!selectedClientId}>
                  {selectedClientId
                    ? `This client only — ${clientName(selectedClientId)}`
                    : "This client only (pick a practice in Builder first)"}
                </option>
              </select>
            </div>

            {/* Recurring-only */}
            {form.kind === "recurring" && (
              <>
                <div>
                  <label className={labelClass}>Cadence</label>
                  <select value={form.cadence} onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))} className={inputClass}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Day of week</label>
                  <select
                    value={form.day_of_week}
                    onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value }))}
                    disabled={form.cadence === "monthly"}
                    className={`${inputClass} disabled:opacity-50`}
                  >
                    <option value="">Any / use the drop date</option>
                    {WEEKDAY_LABEL.map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                  {form.cadence === "monthly" && (
                    <p className="mt-1 text-xs text-slate-400">Monthly posts land on the day you drop them.</p>
                  )}
                </div>
              </>
            )}

            {/* Arc-only */}
            {form.kind === "arc" && (
              <div>
                <label className={labelClass}>Days between parts</label>
                <input
                  type="number"
                  min={1}
                  value={form.spacing_days}
                  onChange={(e) => setForm((f) => ({ ...f, spacing_days: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Arc parts */}
          {form.kind === "arc" && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className={labelClass}>Parts, in order</span>
                <button onClick={addPart} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                  + Add part
                </button>
              </div>
              <div className="space-y-2">
                {form.parts.map((p, i) => (
                  <div key={i} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.65rem] font-bold text-white">
                        {i + 1}
                      </span>
                      <input
                        value={p.title}
                        onChange={(e) => setPart(i, { title: e.target.value })}
                        placeholder={`Part ${i + 1} title`}
                        className="flex-1 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                      />
                      <button onClick={() => movePart(i, -1)} disabled={i === 0} title="Move up" className="text-slate-400 hover:text-slate-900 disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => movePart(i, 1)} disabled={i === form.parts.length - 1} title="Move down" className="text-slate-400 hover:text-slate-900 disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                      <button onClick={() => removePart(i)} disabled={form.parts.length === 1} title="Remove part" className="text-slate-400 hover:text-red-600 disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      value={p.description}
                      onChange={(e) => setPart(i, { description: e.target.value })}
                      rows={2}
                      placeholder="What this part covers"
                      className="mb-2 w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                    />
                    <input
                      value={p.suggested_shot}
                      onChange={(e) => setPart(i, { suggested_shot: e.target.value })}
                      placeholder="Suggested shot (optional) — seeds the post's shot list"
                      className="w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving || !form.title.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create series"}
            </button>
            <button onClick={resetForm} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {active.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No series yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Create one to drag whole runs of posts onto the calendar at once.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              clientLabel={clientName(s.client_id)}
              onEdit={isAdminUser ? () => startEdit(s) : undefined}
              onArchive={isAdminUser ? () => void archive(s.id) : undefined}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-900">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                <p className="text-sm font-semibold text-slate-500">{s.title}</p>
                {isAdminUser && (
                  <button onClick={() => void restore(s.id)} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function SeriesCard({
  series,
  clientLabel,
  onEdit,
  onArchive,
}: {
  series: SocialSeriesWithParts;
  clientLabel?: string;
  onEdit?: () => void;
  onArchive?: () => void;
}) {
  const ct = getCampaignType(series.campaign_type);
  const ps = purposeStyle(series.purpose);
  const isArc = series.kind === "arc";

  const rhythm = isArc
    ? `${series.parts.length} part${series.parts.length === 1 ? "" : "s"}${
        series.spacing_days ? ` · every ${series.spacing_days}d` : ""
      }`
    : [
        series.cadence ? CADENCE_LABEL[series.cadence] ?? series.cadence : null,
        series.day_of_week != null ? WEEKDAY_SHORT[series.day_of_week] : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{series.title}</p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
            isArc ? "border-violet-200/60 bg-violet-50 text-violet-700" : "border-sky-200/60 bg-sky-50 text-sky-700"
          }`}
        >
          {isArc ? <Layers size={10} /> : <Repeat size={10} />}
          {isArc ? "Arc" : "Recurring"}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-slate-600">{series.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {series.purpose && (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ps.pill}`}>{ps.label}</span>
        )}
        {ct && (
          <span className="rounded-full border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
            {ct.label}
          </span>
        )}
        {rhythm && <span className="text-xs font-medium text-slate-400">{rhythm}</span>}
      </div>

      {isArc && series.parts.length > 0 && (
        <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {[...series.parts]
            .sort((a, b) => a.part_number - b.part_number)
            .map((p) => (
              <li key={p.id} className="flex gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-400">{p.part_number}.</span>
                <span className="truncate">{p.title}</span>
              </li>
            ))}
        </ol>
      )}

      <div className="mt-3 flex items-center justify-between">
        {clientLabel && <p className="text-xs font-medium text-slate-400">{clientLabel}</p>}
        {(onEdit || onArchive) && (
          <div className="flex gap-3">
            {onEdit && (
              <button onClick={onEdit} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                Edit
              </button>
            )}
            {onArchive && (
              <button onClick={onArchive} className="text-xs font-semibold text-slate-400 hover:text-red-600">
                Archive
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
