"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import type { ClientReportModel } from "@/lib/reporting/types";
import type { ReportDraft, SectionKey } from "@/lib/reporting/draft-types";
import { SECTION_LABELS } from "@/lib/reporting/draft-types";

// Values that mean no real data — hidden from KPI list
const EMPTY_VALUES = new Set([
  "not connected", "not synced", "coming soon", "not available",
  "not enough data", "n/a",
]);
function hasRealData(v: string) {
  const lower = v.toLowerCase().trim();
  return !EMPTY_VALUES.has(lower) && lower !== "0";
}

type Props = {
  report: ClientReportModel;
  clientId: number;
  existingDraft: ReportDraft | null;
};

function SectionToggle({
  sectionKey,
  visible,
  onToggle,
}: {
  sectionKey: SectionKey;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition ${
        visible
          ? "bg-bip-accent/10 text-bip-accent border border-bip-accent/20"
          : "bg-white/[0.04] text-white/30 border border-white/[0.06]"
      }`}
    >
      {visible ? <Eye size={11} /> : <EyeOff size={11} />}
      {visible ? "Included" : "Hidden"}
    </button>
  );
}

type CollapsibleSectionProps = {
  title: string;
  sectionKey: SectionKey;
  visible: boolean;
  onToggle: () => void;
  comment: string;
  onCommentChange: (v: string) => void;
  children?: React.ReactNode;
};

function CollapsibleSection({
  title, sectionKey, visible, onToggle, comment, onCommentChange, children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`rounded-xl border transition ${
      visible ? "border-white/[0.08] bg-bip-card" : "border-white/[0.04] bg-bip-card/40 opacity-60"
    }`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {title}
        </button>
        <SectionToggle sectionKey={sectionKey} visible={visible} onToggle={onToggle} />
      </div>

      {open && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
          {children}
          <div>
            <label className="text-[11px] text-white/30 uppercase tracking-wider">
              Strategist note (appears below this section in the report)
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Add context, explanation, or commentary…"
              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-bip-page/50 px-3 py-2 text-sm text-white/75 placeholder-white/20 focus:border-bip-accent/30 focus:outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportDraftEditor({ report, clientId, existingDraft }: Props) {
  const router = useRouter();

  // Initialise draft state from existing draft or defaults
  const [narrative, setNarrative] = useState(existingDraft?.narrative ?? "");
  const [windowLabel, setWindowLabel] = useState(existingDraft?.window_label ?? "Last 30 days");

  const allSections: SectionKey[] = ["kpis", "gsc_top_pages", "keywords", "social"];

  const defaultVisibility = Object.fromEntries(
    allSections.map((k) => [k, existingDraft?.section_visibility[k] ?? true]),
  ) as Record<SectionKey, boolean>;

  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionKey, boolean>>(
    defaultVisibility,
  );

  const [sectionComments, setSectionComments] = useState<Record<string, string>>(
    existingDraft?.section_comments ?? {},
  );

  const realKpis = report.kpis.filter((k) => hasRealData(k.value));
  const [kpiOverrides, setKpiOverrides] = useState<Record<string, { hidden?: boolean; value?: string }>>(
    existingDraft?.kpi_overrides ?? {},
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);

  // ── Keyword management ──────────────────────────────────────────────────────
  type KwRow = { id?: number; keyword: string; tag: string };
  const [keywords, setKeywords] = useState<KwRow[]>([]);
  const [kwLoading, setKwLoading] = useState(true);
  const [kwInput, setKwInput] = useState("");
  const [kwTag, setKwTag] = useState("");
  const [kwSaving, setKwSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/reporting/keywords?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d: { rows?: { id: number; keyword: string; tag: string | null }[] }) => {
        setKeywords((d.rows ?? []).map((r) => ({ id: r.id, keyword: r.keyword, tag: r.tag ?? "" })));
      })
      .catch(() => {})
      .finally(() => setKwLoading(false));
  }, [clientId]);

  async function addKeyword() {
    const kw = kwInput.trim();
    if (!kw || kwSaving) return;
    setKwSaving(true);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, upserts: [{ keyword: kw, tag: kwTag.trim() || null, priority: 50, isActive: true }] }),
      });
      const d = await res.json() as { rows?: { id: number; keyword: string; tag: string | null }[] };
      setKeywords((d.rows ?? []).map((r) => ({ id: r.id, keyword: r.keyword, tag: r.tag ?? "" })));
      setKwInput("");
      setKwTag("");
    } catch { /* noop */ } finally { setKwSaving(false); }
  }

  async function removeKeyword(id: number | undefined, keyword: string) {
    if (id == null) return;
    setKwSaving(true);
    try {
      const res = await fetch("/api/reporting/keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, deleteIds: [id] }),
      });
      const d = await res.json() as { rows?: { id: number; keyword: string; tag: string | null }[] };
      setKeywords((d.rows ?? []).map((r) => ({ id: r.id, keyword: r.keyword, tag: r.tag ?? "" })));
    } catch { /* noop */ } finally { setKwSaving(false); }
  }

  const toggleSection = useCallback((key: SectionKey) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }, []);

  const updateComment = useCallback((key: string, val: string) => {
    setSectionComments((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const toggleKpi = useCallback((id: string) => {
    setKpiOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], hidden: !prev[id]?.hidden },
    }));
    setSaved(false);
  }, []);

  const overrideKpiValue = useCallback((id: string, value: string) => {
    setKpiOverrides((prev) => ({ ...prev, [id]: { ...prev[id], value } }));
    setSaved(false);
  }, []);

  async function generateIntro() {
    setGeneratingIntro(true);
    setIntroError(null);
    try {
      const gains = report.perfRows
        .filter((r) => (r.deltaPercent ?? 0) > 0)
        .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0));

      const res = await fetch(`/api/reports/${clientId}/generate-intro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: report.client.account_name,
          strategist: report.client.marketing_strategist,
          windowLabel,
          kpis: realKpis.map((k) => ({ label: k.label, value: kpiOverrides[k.id]?.value ?? k.value })),
          gains: gains.map((r) => ({ label: r.label, deltaPercent: r.deltaPercent ?? 0 })),
          channels: [report.channels.ga4, report.channels.ads, report.channels.searchConsole]
            .filter((c) => c.metrics.length > 0)
            .map((c) => ({
              title: c.title,
              metrics: c.metrics.map((m) => ({ label: m.label, current: m.current, valueSuffix: m.valueSuffix })),
            })),
          recommendations: report.recommendations,
        }),
      });
      const json = await res.json() as { intro?: string; error?: string };
      if (!res.ok || !json.intro) throw new Error(json.error ?? "Generation failed");
      setNarrative(json.intro);
      setSaved(false);
    } catch (e) {
      setIntroError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGeneratingIntro(false);
    }
  }

  async function saveDraft() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/reports/${clientId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window_label: windowLabel,
          narrative: narrative.trim() || null,
          section_visibility: sectionVisibility,
          kpi_overrides: kpiOverrides,
          section_comments: sectionComments,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function generateReport() {
    await saveDraft();
    router.push(`/reports/${clientId}`);
  }

  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const socialWindow = report.socialDailyRows.filter(
    (r) => new Date(r.snapshot_date).getTime() >= cutoff30,
  );
  const socialTotals = socialWindow.reduce(
    (acc, r) => ({
      reach: acc.reach + (r.reach ?? 0),
      engagement: acc.engagement + (r.engagement ?? 0),
      impressions: acc.impressions + (r.impressions ?? 0),
      follows: acc.follows + (r.follows ?? 0),
    }),
    { reach: 0, engagement: 0, impressions: 0, follows: 0 },
  );

  return (
    <div className="min-h-screen bg-bip-page">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-bip-page/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/clients/${clientId}`}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
          >
            <ArrowLeft size={13} /> Back to client
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-sm font-medium text-white/70">
            {report.client.account_name}
          </span>
          <span className="rounded bg-bip-accent/10 px-2 py-0.5 text-[11px] font-medium text-bip-accent">
            Draft
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          {saved && !saving && (
            <span className="text-xs text-emerald-400">Saved</span>
          )}
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/60 hover:text-white transition disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save draft
          </button>
          <button
            type="button"
            onClick={generateReport}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-3 py-1.5 text-xs font-semibold text-bip-accent hover:bg-bip-accent/20 transition disabled:opacity-40"
          >
            <FileText size={12} /> Generate Report →
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">

        {/* Window + intro */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-white">Edit Report Draft</h1>
          <p className="text-xs text-white/40">
            Toggle sections, override values, and add strategist commentary before generating the PDF.
          </p>
        </div>

        {/* Reporting window */}
        <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Reporting window</p>
          <div className="flex gap-2">
            {["Last 7 days", "Last 30 days", "Last 90 days"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => { setWindowLabel(label); setSaved(false); }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  windowLabel === label
                    ? "border-bip-accent/40 bg-bip-accent/10 text-bip-accent"
                    : "border-white/[0.08] text-white/40 hover:text-white/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategist narrative */}
        <div className="rounded-xl border border-white/[0.08] bg-bip-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
              Strategist intro <span className="normal-case font-normal text-white/20">(appears at top of report)</span>
            </p>
            <button
              type="button"
              onClick={generateIntro}
              disabled={generatingIntro}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent hover:bg-bip-accent/20 transition disabled:opacity-50"
            >
              {generatingIntro
                ? <Loader2 size={12} className="animate-spin" />
                : <Sparkles size={12} />}
              {generatingIntro ? "Generating…" : "Generate with AI"}
            </button>
          </div>
          {introError && (
            <p className="text-xs text-red-400">{introError}</p>
          )}
          {generatingIntro && (
            <p className="text-xs text-white/30 animate-pulse">
              Analyzing metrics and drafting your intro…
            </p>
          )}
          <textarea
            rows={5}
            value={narrative}
            onChange={(e) => { setNarrative(e.target.value); setSaved(false); }}
            placeholder={`Hi [Client name],\n\nHere's a summary of your performance over the past 30 days…`}
            className="w-full rounded-lg border border-white/[0.08] bg-bip-page/50 px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:border-bip-accent/30 focus:outline-none resize-none"
          />
          <p className="text-[11px] text-white/20">AI draft based on this client&apos;s strongest metrics — edit freely before generating the report.</p>
        </div>

        {/* Performance Overview */}
        <CollapsibleSection
          title={SECTION_LABELS.kpis}
          sectionKey="kpis"
          visible={sectionVisibility.kpis}
          onToggle={() => toggleSection("kpis")}
          comment={sectionComments.kpis ?? ""}
          onCommentChange={(v) => updateComment("kpis", v)}
        >
          <div className="space-y-1">
            {[report.channels.ads, report.channels.searchConsole, report.channels.ga4]
              .filter((c) => c.metrics.length > 0)
              .map((c) => (
                <div key={c.source} className="rounded border border-white/[0.06] px-2 py-1.5 text-xs text-white/40">
                  {c.title} — {c.metrics.length} metrics
                </div>
              ))}
            {report.channels.ads.metrics.length === 0 && report.channels.searchConsole.metrics.length === 0 && (
              <p className="text-xs text-white/30">No channel data synced yet.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Search Traffic */}
        <CollapsibleSection
          title={SECTION_LABELS.gsc_top_pages}
          sectionKey="gsc_top_pages"
          visible={sectionVisibility.gsc_top_pages}
          onToggle={() => toggleSection("gsc_top_pages")}
          comment={sectionComments.gsc_top_pages ?? ""}
          onCommentChange={(v) => updateComment("gsc_top_pages", v)}
        >
          <p className="text-xs text-white/30">
            {report.gscTopPages.length > 0
              ? `${report.gscTopPages.length} top pages · ${report.gscTopPages.reduce((s, p) => s + p.clicks, 0).toLocaleString()} total clicks`
              : "No GSC top-page data synced yet."}
          </p>
        </CollapsibleSection>

        {/* Social Media */}
        <CollapsibleSection
          title={SECTION_LABELS.social}
          sectionKey="social"
          visible={sectionVisibility.social}
          onToggle={() => toggleSection("social")}
          comment={sectionComments.social ?? ""}
          onCommentChange={(v) => updateComment("social", v)}
        >
          <p className="text-xs text-white/30">
            {socialWindow.length > 0
              ? `${socialWindow.length} days · ${socialTotals.reach.toLocaleString()} reach · ${socialTotals.engagement.toLocaleString()} engagements · ${socialTotals.follows.toLocaleString()} follows`
              : "No social data synced yet — run Social sync from the Connections tab."}
          </p>
        </CollapsibleSection>

        {/* Keywords */}
        <CollapsibleSection
          title={SECTION_LABELS.keywords}
          sectionKey="keywords"
          visible={sectionVisibility.keywords}
          onToggle={() => toggleSection("keywords")}
          comment={sectionComments.keywords ?? ""}
          onCommentChange={(v) => updateComment("keywords", v)}
        >
          <div className="space-y-3">
            {kwLoading ? (
              <p className="text-xs text-white/30">Loading…</p>
            ) : keywords.length === 0 ? (
              <p className="text-xs text-white/30">No keywords tracked yet — add some below.</p>
            ) : (
              <ul className="space-y-1.5">
                {keywords.map((kw) => (
                  <li key={kw.id ?? kw.keyword} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <span className="text-sm text-white/75">{kw.keyword}</span>
                    {kw.tag && <span className="text-[10px] text-white/30 font-mono">{kw.tag}</span>}
                    <button
                      type="button"
                      onClick={() => void removeKeyword(kw.id, kw.keyword)}
                      disabled={kwSaving}
                      className="ml-auto shrink-0 text-white/20 hover:text-red-400 transition disabled:opacity-40"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add keyword */}
            <div className="flex gap-2">
              <input
                type="text"
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addKeyword(); } }}
                placeholder="Add keyword…"
                className="flex-1 rounded-lg border border-white/[0.08] bg-bip-page/50 px-3 py-1.5 text-sm text-white/75 placeholder-white/20 focus:border-bip-accent/30 focus:outline-none"
              />
              <input
                type="text"
                value={kwTag}
                onChange={(e) => setKwTag(e.target.value)}
                placeholder="Tag (optional)"
                className="w-28 rounded-lg border border-white/[0.08] bg-bip-page/50 px-3 py-1.5 text-sm text-white/75 placeholder-white/20 focus:border-bip-accent/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void addKeyword()}
                disabled={!kwInput.trim() || kwSaving}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/50 hover:text-white transition disabled:opacity-40"
              >
                {kwSaving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Add
              </button>
            </div>
          </div>
        </CollapsibleSection>

        {/* Bottom CTA */}
        <div className="flex justify-end gap-3 pt-2 pb-8">
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-white/60 hover:text-white transition disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save draft
          </button>
          <button
            type="button"
            onClick={generateReport}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/40 bg-bip-accent/10 px-4 py-2 text-sm font-semibold text-bip-accent hover:bg-bip-accent/20 transition disabled:opacity-40"
          >
            <FileText size={13} /> Generate Report →
          </button>
        </div>
      </div>
    </div>
  );
}
